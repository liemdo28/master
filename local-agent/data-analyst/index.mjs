/**
 * Data Analyst Layer — index.mjs
 * Mi CEO Daily Work Automation — Data Analysis capability
 */

export { DataAnalystEngine, quickAnalyze } from './DataAnalystEngine.mjs';
export { readCSVFile, parseCSVText } from './CSVReader.mjs';
export { readExcelFile, getSheetNames } from './ExcelReader.mjs';
export { extractPDFText } from './PDFTextExtractor.mjs';
export { extractWordText } from './WordTextExtractor.mjs';
export { mapColumns, normalizeRow, normalizeDataset, normalizeDate, parseHour, parseNumber, STANDARD_FIELDS } from './ColumnMapper.mjs';
export { checkDataQuality } from './DataQualityChecker.mjs';
export { ingestFile, ingestFiles } from './FileDataIngestionService.mjs';
export {
  revenueByDay, revenueByHour, revenueByWeekday,
  itemPerformance, revenueByCategory, paymentBreakdown,
  weekOverWeekTrend, summaryStats,
} from './SalesAnalyticsEngine.mjs';
export { generateOpportunities, generateReportText } from './OpportunityEngine.mjs';
export { addDataset, getDataset, getAllDatasets, searchDatasets, getLatestDataset, saveAnalysisReport, getLastAnalysis } from './DatasetCatalog.mjs';
export { readGoogleSheet } from './GoogleSheetReader.mjs';
export { getGmailAttachmentList } from './GmailAttachmentReader.mjs';
export { searchDriveDataFiles } from './GoogleDriveFileReader.mjs';
