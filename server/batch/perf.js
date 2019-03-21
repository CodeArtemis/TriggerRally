/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * Copyright (C) 2012 jareiko / http://www.jareiko.net/
 */

const mongoose = require('mongoose');
const config = require('./config');
require('./objects');

const MetricsRecord = mongoose.model('MetricsRecord');

mongoose.connect(config.MONGOOSE_URL);


const getMetrics = function(callback) {
  MetricsRecord.find(callback);
};


getMetrics(function(err, metricsRecords) {
  if (err) {
    console.log(err);
  } else {
    let count, time;
    const totalHist = {};
    let totalCount = 0;
    for (let record of Array.from(metricsRecords)) {
      for (let slice of Array.from(record.performanceData.timeSlices)) {
        const hist = slice.histogram;
        if (hist != null) {
          for (time in hist) {
            count = hist[time];
            totalHist[time] = (totalHist[time] || 0) + count;
            totalCount += count;
          }
        }
      }
    }

    if (false) {
      // Write output in CSV format.
      console.log('dt,freq');
      for (time in totalHist) {
        count = totalHist[time];
        console.log(time + ',' + ((100 * count) / totalCount));
      }
    }

    if (true) {
      // Write summary of important stats.
      const buckets = [ 60, 30, 20, 15, 0];
      const coarseHist = {};
      let totalTimeCount = 0;
      for (time in totalHist) {
        count = totalHist[time];
        for (let bucket of Array.from(buckets)) {
          const threshold = bucket ? 1100 / bucket : Infinity;
          if (time < threshold) {
            const timeCount = time * count;
            coarseHist[bucket] = (coarseHist[bucket] || 0) + timeCount;
            totalTimeCount += timeCount;
            break;
          }
        }
      }
      console.log('fps\tpercent');
      for (time in coarseHist) {
        count = coarseHist[time];
        console.log(time + '\t' + ((100 * count) / totalTimeCount));
      }
    }
  }
  process.exit();
});
