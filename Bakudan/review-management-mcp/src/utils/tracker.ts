import fs from "fs";
import path from "path";

interface ResponseRecord {
  review_id: string;
  restaurant: string;
  response_text: string;
  timestamp: string;
  approved_by_owner: boolean;
}

export class ResponseTracker {
  private trackerFile: string;
  private responses: Map<string, ResponseRecord>;

  constructor(trackerFile?: string) {
    this.trackerFile = trackerFile ?? path.join(process.cwd(), "logs", "response-history.json");
    this.responses = new Map();
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.trackerFile)) {
        const data = JSON.parse(fs.readFileSync(this.trackerFile, "utf-8"));
        this.responses = new Map(
          (data.responses ?? []).map((r: ResponseRecord) => [r.review_id, r])
        );
      }
    } catch {
      // start fresh if file is corrupted
    }
  }

  private save() {
    try {
      fs.mkdirSync(path.dirname(this.trackerFile), { recursive: true });
      fs.writeFileSync(
        this.trackerFile,
        JSON.stringify(
          { responses: Array.from(this.responses.values()), last_updated: new Date().toISOString() },
          null,
          2
        )
      );
    } catch (err) {
      console.error("ResponseTracker save error:", err);
    }
  }

  hasResponded(reviewId: string): boolean {
    return this.responses.has(reviewId);
  }

  recordResponse(
    reviewId: string,
    responseText: string,
    approvedByOwner: boolean,
    restaurant: string
  ): void {
    this.responses.set(reviewId, {
      review_id: reviewId,
      restaurant,
      response_text: responseText,
      timestamp: new Date().toISOString(),
      approved_by_owner: approvedByOwner,
    });
    this.save();
  }

  getHistory(sinceDate?: string, limit?: number): ResponseRecord[] {
    let records = Array.from(this.responses.values());

    if (sinceDate) {
      const cutoff = new Date(sinceDate);
      records = records.filter((r) => new Date(r.timestamp) >= cutoff);
    }

    records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return limit ? records.slice(0, limit) : records;
  }

  getStats() {
    const records = Array.from(this.responses.values());
    return {
      total_responses: records.length,
      auto_posted: records.filter((r) => !r.approved_by_owner).length,
      manually_approved: records.filter((r) => r.approved_by_owner).length,
    };
  }
}
