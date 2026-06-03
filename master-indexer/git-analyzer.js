/**
 * Git Analyzer
 * Extracts Git metadata from project repositories
 */

const { execSync } = require('child_process');
const path = require('path');

class GitAnalyzer {
  /**
   * Analyze a Git repository
   */
  analyze(repoPath) {
    const result = {
      remote: null,
      branch: 'unknown',
      status: 'unknown',
      commit: null,
      commitMessage: null,
      commitAuthor: null,
      commitDate: null,
      ahead: 0,
      behind: 0,
      isClean: true,
      tags: []
    };
    
    try {
      // Check if it's a git repo
      if (!this.isGitRepo(repoPath)) {
        return result;
      }
      
      result.status = 'git';
      
      // Get remote URL
      result.remote = this.getRemote(repoPath);
      
      // Get current branch
      result.branch = this.getCurrentBranch(repoPath);
      
      // Get commit info
      const commitInfo = this.getCommitInfo(repoPath);
      result.commit = commitInfo.hash;
      result.commitMessage = commitInfo.message;
      result.commitAuthor = commitInfo.author;
      result.commitDate = commitInfo.date;
      
      // Get status (ahead/behind)
      const syncStatus = this.getSyncStatus(repoPath);
      result.ahead = syncStatus.ahead;
      result.behind = syncStatus.behind;
      result.isClean = syncStatus.isClean;
      
      // Update status based on sync
      if (!syncStatus.isClean) {
        result.status = 'modified';
      } else if (syncStatus.behind > 0) {
        result.status = 'behind';
      } else if (syncStatus.ahead > 0) {
        result.status = 'ahead';
      } else {
        result.status = 'clean';
      }
      
      // Get tags
      result.tags = this.getTags(repoPath);
      
    } catch (error) {
      console.warn(`Git analysis error for ${repoPath}: ${error.message}`);
    }
    
    return result;
  }
  
  /**
   * Check if path is a git repository
   */
  isGitRepo(repoPath) {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: repoPath,
        stdio: 'pipe',
        timeout: 5000
      });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get remote URL
   */
  getRemote(repoPath) {
    try {
      const output = execSync('git remote get-url origin', {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000
      }).trim();
      
      // Clean up the URL (remove .git suffix, convert SSH to HTTPS if needed)
      return output
        .replace(/\.git$/, '')
        .replace(/^git@github\.com:/, 'https://github.com/');
    } catch {
      return null;
    }
  }
  
  /**
   * Get current branch name
   */
  getCurrentBranch(repoPath) {
    try {
      return execSync('git branch --show-current', {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000
      }).trim();
    } catch {
      try {
        // Fallback for detached HEAD
        return execSync('git rev-parse --short HEAD', {
          cwd: repoPath,
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 5000
        }).trim();
      } catch {
        return 'unknown';
      }
    }
  }
  
  /**
   * Get latest commit info
   */
  getCommitInfo(repoPath) {
    try {
      const output = execSync(
        'git log -1 --format="%H|%s|%an|%ai"',
        {
          cwd: repoPath,
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 5000
        }
      ).trim();
      
      const [hash, message, author, date] = output.split('|');
      
      return {
        hash: hash || null,
        message: message || null,
        author: author || null,
        date: date ? new Date(date).toISOString() : null
      };
    } catch {
      return { hash: null, message: null, author: null, date: null };
    }
  }
  
  /**
   * Get sync status (ahead/behind remote)
   */
  getSyncStatus(repoPath) {
    try {
      // Fetch first to get accurate ahead/behind
      execSync('git fetch --prune', {
        cwd: repoPath,
        stdio: 'pipe',
        timeout: 10000
      });
    } catch {
      // Fetch failed, continue with local status
    }
    
    try {
      const output = execSync('git status --porcelain', {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000
      });
      
      const isClean = output.trim() === '';
      
      // Try to get ahead/behind count
      let ahead = 0;
      let behind = 0;
      
      try {
        const revParse = execSync('git rev-parse HEAD', {
          cwd: repoPath,
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 5000
        }).trim();
        
        const remoteRef = execSync('git for-each-ref --format="%(upstream:short)" refs/heads/' + this.getCurrentBranch(repoPath), {
          cwd: repoPath,
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 5000
        }).trim();
        
        if (remoteRef) {
          const revList = execSync(`git rev-list --left-right --count ${revParse}...${remoteRef}`, {
            cwd: repoPath,
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 5000
          }).trim().split('\t');
          
          ahead = parseInt(revList[0]) || 0;
          behind = parseInt(revList[1]) || 0;
        }
      } catch {
        // ahead/behind detection failed
      }
      
      return { isClean, ahead, behind };
    } catch {
      return { isClean: true, ahead: 0, behind: 0 };
    }
  }
  
  /**
   * Get tags for the repository
   */
  getTags(repoPath) {
    try {
      const output = execSync('git tag --sort=-version:refname | head -10', {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000
      }).trim();
      
      return output ? output.split('\n') : [];
    } catch {
      return [];
    }
  }
  
  /**
   * Get list of recent commits
   */
  getRecentCommits(repoPath, count = 10) {
    try {
      const output = execSync(`git log --oneline -${count}`, {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000
      }).trim();
      
      return output.split('\n').map(line => {
        const [hash, ...messageParts] = line.split(' ');
        return {
          hash,
          message: messageParts.join(' ')
        };
      });
    } catch {
      return [];
    }
  }
  
  /**
   * Get changed files in last commit
   */
  getLastChangedFiles(repoPath) {
    try {
      const output = execSync('git diff --name-status HEAD~1..HEAD', {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000
      }).trim();
      
      return output.split('\n').filter(Boolean).map(line => {
        const [status, file] = line.split('\t');
        return { status, file };
      });
    } catch {
      return [];
    }
  }
}

module.exports = { GitAnalyzer };
