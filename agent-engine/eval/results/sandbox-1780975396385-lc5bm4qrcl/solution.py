import heapq

def find_largest_numbers(nums, n):
    # Use nlargest from heapq to find the n largest numbers in the list
    largest_nums = heapq.nlargest(n, nums)
    return largest_nums