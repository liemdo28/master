import re  
  
with open('lang/en-US.php', encoding='utf-8') as f:  
    en_lines = f.readlines()  
with open('lang/vi-VN.php', encoding='utf-8') as f:  
    vi_lines = f.readlines()  
  
pat = re.compile(r"^\s+'([^']+)'\s*=>\s*'(.*)',?$")  
  
def parse(lines):  
    d = {}  
    for l in lines:  
        m = pat.match(l.strip())  
        if m: d[m.group(1)] = m.group(2)  
    return d  
  
en = parse(en_lines)  
vi = parse(vi_lines)  
same = [k for k in sorted(en) if k in vi and en[k] == vi[k] and en[k]]  
print(f"Same: {len(same)}")  
for k in same:  
    print(f"  {k}: {en[k]}") 
