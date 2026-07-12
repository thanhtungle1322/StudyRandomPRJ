const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const reportService = require('../services/reportService');

const { ReportService } = reportService;

describe('ReportService', () => {
  test('persists a normalized pending report', async () => {
    let created;
    const service = new ReportService({
      ReportModel: {
        async create(report) {
          created = report;
          return { _id: 'report-id', ...report };
        },
      },
    });

    const result = await service.submitReport({
      reporterId: 'user-a',
      category: 'harassment',
      description: '  Nội dung cần xem xét  ',
    });

    assert.equal(result._id, 'report-id');
    assert.deepEqual(created, {
      reporterId: 'user-a',
      category: 'harassment',
      description: 'Nội dung cần xem xét',
      status: 'pending',
    });
  });

  test('rejects unknown categories and oversized descriptions', async () => {
    const service = new ReportService({ ReportModel: { create: async () => ({}) } });

    await assert.rejects(
      service.submitReport({ reporterId: 'user-a', category: 'unknown' }),
      (error) => error.status === 400
    );
    await assert.rejects(
      service.submitReport({ reporterId: 'user-a', category: 'spam', description: 'short' }),
      (error) => error.status === 400
    );
    await assert.rejects(
      service.submitReport({ reporterId: 'user-a', category: 'spam', description: 'x'.repeat(1001) }),
      (error) => error.status === 400
    );
  });
});