def min_cost_path(cost):
    m = len(cost)
    n = len(cost[0])
    
    # Create a 2D array to store the minimum cost to reach each cell
    dp = [[float('inf')] * n for _ in range(m)]
    
    # Initialize the starting point
    dp[0][0] = cost[0][0]
    
    # Fill the first row
    for j in range(1, n):
        dp[0][j] = dp[0][j-1] + cost[0][j]
    
    # Fill the first column
    for i in range(1, m):
        dp[i][0] = dp[i-1][0] + cost[i][0]
    
    # Fill the rest of the dp array
    for i in range(1, m):
        for j in range(1, n):
            dp[i][j] = min(dp[i-1][j], dp[i][j-1]) + cost[i][j]
    
    # The minimum cost to reach (m-1, n-1)
    return dp[m-1][n-1]

# Example usage:
cost = [
    [1, 3, 1],
    [1, 5, 1],
    [4, 2, 1]
]
print(min_cost_path(cost))  # Output: 7