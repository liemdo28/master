```python
from typing import List

def below_zero(operations: List[int]) -> bool:
    current_balance = 0
    for op in operations:
        current_balance += op
        if current_balance < 0:
            return True
    return False
```