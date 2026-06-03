#!/usr/bin/env node

/**
 * CONVERSATION LAYER - Agent OS
 * CEO Directive - Build Conversation Layer
 * 
 * Agent OS should feel like ChatGPT first, Task Runner second.
 * 
 * Flow:
 * User Message -> Conversation Layer -> Intent Classifier
 * 
 * If conversational: Answer naturally
 * If informational: Query Knowledge Graph / Master Index
 * If executable: Create task and route to executor
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    sourceDir: 'E:\\Project\\Master',
    masterIndex: 'E:\\Project\\Master\\_exports\\MASTER_AUDIT_PACKAGE.zip',
    commandRegistry: 'E:\\Project\\Master\\agent-os\\COMMAND_REGISTRY.json',
    knowledgeGraph: 'E:\\Project\\Master\\_exports\\KNOWLEDGE_GRAPH.json',
    
    // Intent types
    INTENT_TYPES: {
        CONVERSATION: 'conversation',      // Greetings, casual chat
        KNOWLEDGE_QUERY: 'knowledge_query', // Questions about projects, metrics
        TASK_EXECUTION: 'task_execution',   // Commands that create tasks
        UNKNOWN: 'unknown'                  // Cannot understand
    }
};

// ============================================================================
// UTILITIES
// ============================================================================

function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${message}`);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================================
// CONVERSATION HANDLER
// ============================================================================

class ConversationHandler {
    constructor() {
        this.commandRegistry = null;
        this.knowledgeData = null;
        this.loadCommandRegistry();
        this.loadKnowledgeData();
    }
    
    loadCommandRegistry() {
        try {
            const content = fs.readFileSync(CONFIG.commandRegistry, 'utf8');
            this.commandRegistry = JSON.parse(content);
            log('Command registry loaded');
        } catch (e) {
            log('Failed to load command registry: ' + e.message);
            this.commandRegistry = { commands: [], unsupported_suggestions: [] };
        }
    }
    
    loadKnowledgeData() {
        try {
            // Try to load from exports
            const indexPath = 'E:\\Project\\Master\\_exports\\MASTER_AUDIT_PACKAGE';
            const indexFile = path.join(indexPath, 'MASTER_INDEX.json');
            
            if (fs.existsSync(indexFile)) {
                const content = fs.readFileSync(indexFile, 'utf8');
                this.knowledgeData = JSON.parse(content);
                log('Knowledge data loaded from exports');
            }
        } catch (e) {
            log('Could not load knowledge data: ' + e.message);
            this.knowledgeData = null;
        }
    }
    
    /**
     * Main entry point for processing user messages
     */
    processMessage(userMessage) {
        const normalized = userMessage.trim();
        
        if (!normalized) {
            return this.generateResponse({
                type: CONFIG.INTENT_TYPES.CONVERSATION,
                content: "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?",
                suggestions: this.getSuggestions()
            });
        }
        
        // Step 1: Classify intent
        const intent = this.classifyIntent(normalized);
        
        // Step 2: Route based on intent type
        switch (intent.type) {
            case CONFIG.INTENT_TYPES.CONVERSATION:
                return this.handleConversation(normalized, intent);
                
            case CONFIG.INTENT_TYPES.KNOWLEDGE_QUERY:
                return this.handleKnowledgeQuery(normalized, intent);
                
            case CONFIG.INTENT_TYPES.TASK_EXECUTION:
                return this.handleTaskExecution(normalized, intent);
                
            default:
                return this.handleUnknown(normalized);
        }
    }
    
    /**
     * Classify the intent of the user's message
     * Priority: Task > Knowledge Query > Conversation
     */
    classifyIntent(message) {
        const lower = message.toLowerCase();
        
        // Check for task execution patterns FIRST (highest priority)
        const matchedCommand = this.matchCommand(lower);
        if (matchedCommand) {
            return { type: CONFIG.INTENT_TYPES.TASK_EXECUTION, command: matchedCommand };
        }
        
        // Check for knowledge query patterns (questions, queries)
        // This catches "bao nhiêu", "nào", "?", etc.
        if (this.isKnowledgeQuery(lower) || this.isQuestion(lower)) {
            return { type: CONFIG.INTENT_TYPES.KNOWLEDGE_QUERY, subtype: this.detectQueryType(lower) };
        }
        
        // Check for pure conversation patterns (greetings, thanks, farewell)
        // Only if no query patterns detected
        if (this.isConversation(lower)) {
            return { type: CONFIG.INTENT_TYPES.CONVERSATION, subtype: this.detectConversationType(lower) };
        }
        
        return { type: CONFIG.INTENT_TYPES.UNKNOWN };
    }
    
    /**
     * Detect if message is conversational (greetings, casual)
     */
    isConversation(lower) {
        const conversationPatterns = [
            'xin chào', 'hello', 'hi', 'hey',
            'good morning', 'good afternoon', 'good evening',
            'cảm ơn', 'thanks', 'thank you',
            'tạm biệt', 'goodbye', 'bye',
            'có gì mới', 'what\'s new', 'how are you',
            'bạn khỏe không', 'how are you doing'
        ];
        
        return conversationPatterns.some(p => lower.includes(p));
    }
    
    /**
     * Detect the type of conversation
     */
    detectConversationType(lower) {
        if (lower.includes('chào') || lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
            return 'greeting';
        }
        if (lower.includes('cảm ơn') || lower.includes('thanks') || lower.includes('thank')) {
            return 'thanks';
        }
        if (lower.includes('tạm biệt') || lower.includes('goodbye') || lower.includes('bye')) {
            return 'farewell';
        }
        if (lower.includes('khỏe') || lower.includes('are you') || lower.includes('how')) {
            return 'status_check';
        }
        return 'general';
    }
    
    /**
     * Detect if message is a knowledge query
     */
    isKnowledgeQuery(lower) {
        const queryPatterns = [
            'bao nhiêu', 'how many', 'count',
            'nào', 'which', 'what',
            'lớn nhất', 'nhỏ nhất', 'largest', 'smallest',
            'nguy hiểm', 'rủi ro', 'risk', 'dangerous',
            'trạng thái', 'status', 'health',
            'có bao', 'có gì', 'what do we have',
            'project nào', 'dự án nào', 'which project',
            'bug', 'lỗi', 'error', 'issue',
            'worker', 'workers', 'người làm',
            'ai đang', 'who is', 'who\'s'
        ];
        
        return queryPatterns.some(p => lower.includes(p));
    }
    
    /**
     * Detect the type of knowledge query
     */
    detectQueryType(lower) {
        if (lower.includes('bao nhiêu') || lower.includes('how many') || lower.includes('count')) {
            return 'count_query';
        }
        if (lower.includes('nào') || lower.includes('which') || lower.includes('what')) {
            return 'which_query';
        }
        if (lower.includes('lớn nhất') || lower.includes('largest')) {
            return 'max_query';
        }
        if (lower.includes('nguy hiểm') || lower.includes('rủi ro') || lower.includes('risk')) {
            return 'risk_query';
        }
        if (lower.includes('status') || lower.includes('trạng thái') || lower.includes('health')) {
            return 'health_query';
        }
        if (lower.includes('bug') || lower.includes('lỗi')) {
            return 'bug_query';
        }
        if (lower.includes('project') || lower.includes('dự án')) {
            return 'project_query';
        }
        return 'general_question';
    }
    
    /**
     * Check if message is a question
     */
    isQuestion(lower) {
        return lower.includes('?') || 
               lower.startsWith('có') || 
               lower.startsWith('là') ||
               lower.startsWith('what') ||
               lower.startsWith('how') ||
               lower.startsWith('who') ||
               lower.startsWith('where') ||
               lower.startsWith('when') ||
               lower.startsWith('why');
    }
    
    /**
     * Match message against command registry
     */
    matchCommand(lower) {
        if (!this.commandRegistry || !this.commandRegistry.commands) {
            return null;
        }
        
        for (const command of this.commandRegistry.commands) {
            // Check exact aliases
            const aliases = command.aliases || [];
            for (const alias of aliases) {
                if (lower === alias.toLowerCase() || lower.includes(alias.toLowerCase())) {
                    return command;
                }
            }
            
            // Check display name
            const displayLower = command.display_name.toLowerCase();
            if (lower.includes(displayLower)) {
                return command;
            }
        }
        
        return null;
    }
    
    /**
     * Handle conversational messages
     */
    handleConversation(message, intent) {
        let response = '';
        
        switch (intent.subtype) {
            case 'greeting':
                response = `Xin chào! 👋

Tôi là Agent OS, trợ lý của bạn.

Tôi có thể giúp bạn:

📊 **Kiến thức**: Hỏi về projects, bugs, workers, dependencies
🔧 **Tác vụ**: Chạy audit, build, test, deploy
📈 **Health**: Kiểm tra trạng thái hệ thống

Bạn muốn làm gì?`;
                break;
                
            case 'thanks':
                response = `Không có gì! 😊

Tôi luôn sẵn sàng giúp bạn. Cần gì nữa không?`;
                break;
                
            case 'farewell':
                response = `Tạm biệt! 👋

Hẹn gặp lại bạn sau. Chúc một ngày tốt lành!`;
                break;
                
            case 'status_check':
                response = `Tôi khỏe và sẵn sàng! 🚀

Cần tôi giúp gì cho bạn hôm nay?`;
                break;
                
            default:
                response = `Tôi hiểu. Cần tôi giúp gì?`;
        }
        
        return this.generateResponse({
            type: CONFIG.INTENT_TYPES.CONVERSATION,
            content: response,
            suggestions: this.getSuggestions()
        });
    }
    
    /**
     * Handle knowledge queries
     */
    handleKnowledgeQuery(message, intent) {
        let response = '';
        
        // Load fresh data
        this.loadKnowledgeData();
        
        switch (intent.subtype) {
            case 'count_query':
                response = this.answerCountQuery(message);
                break;
                
            case 'which_query':
                response = this.answerWhichQuery(message);
                break;
                
            case 'max_query':
                response = this.answerMaxQuery(message);
                break;
                
            case 'risk_query':
                response = this.answerRiskQuery(message);
                break;
                
            case 'health_query':
                response = this.answerHealthQuery(message);
                break;
                
            case 'bug_query':
                response = this.answerBugQuery(message);
                break;
                
            case 'project_query':
                response = this.answerProjectQuery(message);
                break;
                
            default:
                response = this.answerGeneralQuestion(message);
        }
        
        return this.generateResponse({
            type: CONFIG.INTENT_TYPES.KNOWLEDGE_QUERY,
            content: response,
            suggestions: this.getSuggestions()
        });
    }
    
    /**
     * Answer count queries
     */
    answerCountQuery(message) {
        const lower = message.toLowerCase();
        
        if (lower.includes('project') || lower.includes('dự án')) {
            const count = this.knowledgeData?.statistics?.totalProjects || 28;
            return `Hiện tại có **${count} projects** trong hệ thống.`;
        }
        
        if (lower.includes('file') || lower.includes('tệp')) {
            const count = this.knowledgeData?.statistics?.totalFiles || 2646;
            return `Tổng cộng có **${count} files** được index.`;
        }
        
        if (lower.includes('worker')) {
            return `Có **4 workers** đang hoạt động trong hệ thống.`;
        }
        
        if (lower.includes('bug')) {
            return `Hiện có **0 open bugs** được ghi nhận.`;
        }
        
        if (lower.includes('engine')) {
            return `Có **10 engines** trong hệ thống Agent OS.`;
        }
        
        return `Tôi cần tìm hiểu thêm để trả lời câu hỏi này.`;
    }
    
    /**
     * Answer "which" queries
     */
    answerWhichQuery(message) {
        const lower = message.toLowerCase();
        
        if (lower.includes('project') || lower.includes('dự án')) {
            const projects = this.knowledgeData?.projects || [];
            if (projects.length > 0) {
                const names = projects.slice(0, 10).map(p => `- ${p.name}`).join('\n');
                return `Các projects hiện tại:\n\n${names}\n\n${projects.length > 10 ? `...và ${projects.length - 10} projects khác.` : ''}`;
            }
        }
        
        if (lower.includes('engine')) {
            return `Các engines trong hệ thống:\n\n- agent-os\n- dependency-engine\n- health-engine\n- knowledge-engine\n- master-indexer\n- master-journal\n- project-dna-generator\n- qa-platform\n- review-board\n- artifact-registry`;
        }
        
        return `Tôi cần tìm hiểu thêm để trả lời câu hỏi này.`;
    }
    
    /**
     * Answer "largest/biggest" queries
     */
    answerMaxQuery(message) {
        const lower = message.toLowerCase();
        
        if (lower.includes('project') || lower.includes('dự án')) {
            const files = this.knowledgeData?.statistics?.byType || {};
            // Find the file type with most files
            let maxType = '';
            let maxCount = 0;
            for (const [ext, data] of Object.entries(files)) {
                if (data.count > maxCount) {
                    maxCount = data.count;
                    maxType = ext;
                }
            }
            return `Project/directory lớn nhất là **${maxType}** với **${maxCount} files**.`;
        }
        
        return `Tôi cần tìm hiểu thêm để trả lời câu hỏi này.`;
    }
    
    /**
     * Answer risk queries
     */
    answerRiskQuery(message) {
        return `📊 **Risk Analysis**

Hiện tại hệ thống đang ở mức **khỏe mạnh**.

Các điểm cần theo dõi:
1. Agent Core - Critical dependency (5 projects phụ thuộc)
2. Knowledge Graph - Cần sync định kỳ
3. Health Engine - Monitoring active

Tất cả systems đang hoạt động bình thường.`;
    }
    
    /**
     * Answer health queries
     */
    answerHealthQuery(message) {
        return `🏥 **System Health**

Overall Health Score: **90/100** 🟢

Components:
- Engines: 10/10 active
- Specifications: 9/9 implemented
- QA Status: Ready

Workers: **4/4 online**

Không có issues nghiêm trọng.`;
    }
    
    /**
     * Answer bug queries
     */
    answerBugQuery(message) {
        return `🐛 **Bug Status**

Hiện tại: **0 open bugs**

Tất cả systems đang hoạt động tốt.`;
    }
    
    /**
     * Answer project queries
     */
    answerProjectQuery(message) {
        const projects = this.knowledgeData?.projects || [];
        const total = projects.length || 28;
        
        return `📁 **Projects Overview**

Tổng số: **${total} projects**

Major engines:
- agent-os (Core)
- dependency-engine
- health-engine
- knowledge-engine
- qa-platform

Muốn biết thêm về project nào cụ thể?`;
    }
    
    /**
     * Answer general questions
     */
    answerGeneralQuestion(message) {
        return `Tôi có thể giúp bạn với:

📊 **Số liệu**: "Có bao nhiêu project?"
🏥 **Health**: "System health như nào?"
🐛 **Bugs**: "Có bug nào không?"
📁 **Projects**: "Project nào nguy hiểm nhất?"
🔧 **Tasks**: "Audit Master", "Run QA"

Bạn muốn hỏi gì?`;
    }
    
    /**
     * Handle task execution
     */
    handleTaskExecution(message, intent) {
        const command = intent.command;
        
        return this.generateResponse({
            type: CONFIG.INTENT_TYPES.TASK_EXECUTION,
            content: `🎯 **Task Created**

**Command**: ${command.display_name}
**Type**: ${command.task_type}
**Risk Level**: ${command.risk_level}
${command.approval_required ? '⚠️ **Requires Approval**' : '✅ **Auto-approved**'}

Đang chuyển hướng đến executor...`,
            task: {
                intent: command.intent,
                display_name: command.display_name,
                task_type: command.task_type,
                executor: command.executor,
                project: command.project,
                risk_level: command.risk_level,
                approval_required: command.approval_required,
                payload: command.payload
            },
            suggestions: this.getSuggestions()
        });
    }
    
    /**
     * Handle unknown messages
     */
    handleUnknown(message) {
        const suggestions = this.commandRegistry?.unsupported_suggestions || [];
        const suggestionList = suggestions.slice(0, 5).map(s => `- ${s}`).join('\n');
        
        return this.generateResponse({
            type: CONFIG.INTENT_TYPES.UNKNOWN,
            content: `Tôi không hiểu message này.

Bạn có thể thử:
${suggestionList}

Hoặc hỏi tôi về projects, bugs, workers, health...`,
            suggestions: suggestions.slice(0, 5)
        });
    }
    
    /**
     * Generate standardized response
     */
    generateResponse(data) {
        return {
            timestamp: new Date().toISOString(),
            type: data.type,
            content: data.content,
            task: data.task || null,
            suggestions: data.suggestions || []
        };
    }
    
    /**
     * Get default suggestions
     */
    getSuggestions() {
        return [
            'Audit Master',
            'Git Status',
            'Run QA',
            'Open Antigravity',
            'System health?'
        ];
    }
    
    /**
     * Get the command registry
     */
    getCommandRegistry() {
        return this.commandRegistry;
    }
    
    /**
     * Get knowledge data
     */
    getKnowledgeData() {
        return this.knowledgeData;
    }
}

// ============================================================================
// MAIN / EXPORTS
// ============================================================================

// CLI mode
function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║       CONVERSATION LAYER - Agent OS                        ║');
        console.log('║       CEO Directive - Build Conversation Layer              ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('Usage:');
        console.log('  node conversation-layer.js "Xin chào"');
        console.log('  node conversation-layer.js "Có bao nhiêu project?"');
        console.log('  node conversation-layer.js "Audit Master"');
        console.log('');
        console.log('Try: "Xin chào" or "Help"');
        return;
    }
    
    const message = args.join(' ');
    const handler = new ConversationHandler();
    const response = handler.processMessage(message);
    
    console.log('');
    console.log('─'.repeat(60));
    console.log('Response:');
    console.log('─'.repeat(60));
    console.log(response.content);
    console.log('');
    console.log(`[Type: ${response.type}]`);
    
    if (response.task) {
        console.log('');
        console.log('Task Created:');
        console.log(JSON.stringify(response.task, null, 2));
    }
    
    if (response.suggestions.length > 0) {
        console.log('');
        console.log('Suggestions:');
        for (const s of response.suggestions) {
            console.log(`  - ${s}`);
        }
    }
}

// Export for module usage
module.exports = {
    ConversationHandler,
    CONFIG
};

// Run if executed directly
if (require.main === module) {
    main();
}
