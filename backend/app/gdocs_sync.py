import os
import json
import re
import hashlib
import argparse
import requests
from datetime import datetime
from bs4 import BeautifulSoup

DATA_FOLDER = os.path.join(os.path.dirname(__file__), "data")
CONFIG_FILE = os.path.join(DATA_FOLDER, "gdocs_config.json")


class GoogleDocsSync:
    def __init__(self):
        os.makedirs(DATA_FOLDER, exist_ok=True)
        self.config = self._load_config()
    
    def _load_config(self):
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"documents": [], "sync_interval_days": 7}
    
    def _save_config(self):
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(self.config, f, indent=2)
    
    def add_document(self, url, name):
        for doc in self.config["documents"]:
            if doc["name"] == name:
                doc["url"] = url
                self._save_config()
                print(f"Updated: {name}")
                return
        
        self.config["documents"].append({
            "name": name,
            "url": url,
            "last_hash": "",
            "last_sync": ""
        })
        self._save_config()
        print(f"Added: {name}")
    
    def list_documents(self):
        if not self.config["documents"]:
            print("No documents tracked")
            return
        
        print("\nTracked Documents:")
        for doc in self.config["documents"]:
            print(f"  {doc['name']}: {doc.get('last_sync', 'Never synced')}")
    
    def fetch_document(self, url):
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return response.text
        except Exception as e:
            print(f"Fetch error: {e}")
            return None
    
    def convert_to_markdown(self, html_content):
        soup = BeautifulSoup(html_content, 'html.parser')
        content_div = soup.find('div', {'id': 'contents'}) or soup.find('body')
        
        if not content_div:
            return ""
        
        lines = []
        section = ""
        
        for el in content_div.descendants:
            if el.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                text = el.get_text(strip=True)
                if text:
                    section = text
                    lines.append(f"\n{'#' * int(el.name[1])} {text}\n")
            
            elif el.name == 'p' and el.parent.name not in ['td', 'th', 'li']:
                text = self._process_paragraph(el)
                if text.strip():
                    lines.append(f"{text}\n")
            
            elif el.name == 'ul' and el.parent.name not in ['td', 'th']:
                for li in el.find_all('li', recursive=False):
                    text = li.get_text(strip=True)
                    if text:
                        lines.append(f"- {text}")
                lines.append("")
            
            elif el.name == 'ol' and el.parent.name not in ['td', 'th']:
                for i, li in enumerate(el.find_all('li', recursive=False), 1):
                    text = li.get_text(strip=True)
                    if text:
                        lines.append(f"{i}. {text}")
                lines.append("")
            
            elif el.name == 'table' and el.parent.name != 'table':
                table_md = self._convert_table(el, section)
                if table_md:
                    lines.append(table_md)
        
        return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()
    
    def _process_paragraph(self, p):
        text = p.get_text(separator=' ', strip=True)
        
        for bold in p.find_all(['b', 'strong']):
            bt = bold.get_text(strip=True)
            if bt:
                text = text.replace(bt, f"**{bt}**", 1)
        
        for italic in p.find_all(['i', 'em']):
            it = italic.get_text(strip=True)
            if it:
                text = text.replace(it, f"*{it}*", 1)
        
        for link in p.find_all('a'):
            lt = link.get_text(strip=True)
            href = link.get('href', '')
            if lt and href:
                text = text.replace(lt, f"[{lt}]({href})", 1)
        
        return text
    
    def _convert_table(self, table, section=""):
        rows = table.find_all('tr')
        if not rows:
            return ""
        
        data = []
        for row in rows:
            cells = row.find_all(['td', 'th'])
            row_data = []
            for cell in cells:
                text = cell.get_text(separator=' ', strip=True)
                text = re.sub(r'\s+', ' ', text.replace('\n', ' ').replace('|', '/'))
                row_data.append(text)
            if any(row_data):
                data.append(row_data)
        
        if not data:
            return ""
        
        max_cols = max(len(r) for r in data)
        for row in data:
            row.extend([""] * (max_cols - len(row)))
        
        lines = []
        if section:
            lines.append(f"\n**Table: {section}**\n")
        
        lines.append("| " + " | ".join(data[0]) + " |")
        lines.append("| " + " | ".join(["---"] * max_cols) + " |")
        for row in data[1:]:
            lines.append("| " + " | ".join(row) + " |")
        
        return "\n" + "\n".join(lines) + "\n"
    
    def sync_document(self, doc):
        print(f"Syncing: {doc['name']}")
        
        html = self.fetch_document(doc['url'])
        if not html:
            return False
        
        md = self.convert_to_markdown(html)
        if not md:
            return False
        
        filepath = os.path.join(DATA_FOLDER, f"{doc['name']}.md")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"# {doc['name'].replace('_', ' ').title()}\n\n")
            f.write(f"*Last synced: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n\n---\n\n")
            f.write(md)
        
        doc['last_hash'] = hashlib.sha256(md.encode()).hexdigest()
        doc['last_sync'] = datetime.now().isoformat()
        self._save_config()
        
        print(f"  Saved: {len(md)} chars")
        return True
    
    def sync_all(self):
        if not self.config["documents"]:
            print("No documents to sync")
            return []
        
        changed = []
        for doc in self.config["documents"]:
            if self.sync_document(doc):
                changed.append(doc['name'])
        
        print(f"Synced {len(changed)} document(s)")
        return changed
    
    def reindex(self):
        try:
            from rag import index_markdown_docs
            index_markdown_docs()
        except Exception as e:
            print(f"Reindex error: {e}")


def main():
    parser = argparse.ArgumentParser(description="Sync Google Docs to Markdown")
    parser.add_argument("--add", metavar="URL", help="Add document URL")
    parser.add_argument("--name", metavar="NAME", help="Document name")
    parser.add_argument("--sync", action="store_true", help="Sync all documents")
    parser.add_argument("--reindex", action="store_true", help="Reindex to ChromaDB")
    parser.add_argument("--list", action="store_true", help="List documents")
    
    args = parser.parse_args()
    syncer = GoogleDocsSync()
    
    if args.add:
        if not args.name:
            print("--name required with --add")
            return
        syncer.add_document(args.add, args.name)
    elif args.list:
        syncer.list_documents()
    elif args.sync:
        syncer.sync_all()
        if args.reindex:
            syncer.reindex()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
