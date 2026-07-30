```python
def separate_paren_groups(paren_string: str) -> List[str]:
    result = []
    current_group = []
    depth = 0

    for char in paren_string.replace(" ", ""):
        if char == '(':
            depth += 1
        elif char == ')':
            depth -= 1
        current_group.append(char)

        if depth == 0 and current_group:
            result.append(''.join(current_group))
            current_group = []

    return result
```