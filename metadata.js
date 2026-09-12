"use strict";
const QuestionMetadata = {
  describe(question) {
    return {
      source: typeof question.source === "string" && question.source.trim() ? question.source : "アプリ内の作成問題（出典未登録）",
      checkedAt: /^\d{4}-\d{2}-\d{2}$/.test(question.checkedAt || "") ? question.checkedAt : "未確認",
      version: String(question.version || "1"),
    };
  },
};
if (typeof module !== "undefined") module.exports = QuestionMetadata;
