import sys

file_path = r'c:\Users\Lenovo\OneDrive\Desktop\NetraID\backend\app\api\v1\kiosk.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the literal backslashes before single quotes
content = content.replace("\\'", "'")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed kiosk.py')
