def find_non_prime_numbers(n):
    non_primes = []
    for num in range(2, n + 1):
        if not is_prime(num):
            non_primes.append(num)
    return non_primes

def is_prime(num):
    if num <= 1:
        return False
    for i in range(2, int(num**0.5) + 1):
        if num % i == 0:
            return False
    return True