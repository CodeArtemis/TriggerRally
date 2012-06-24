###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

mongoose = require 'mongoose'
config = require './config'
require './objects'

MetricsRecord = mongoose.model 'MetricsRecord'

mongoose.connect config.MONGOOSE_URL


getMetrics = (callback) ->
  MetricsRecord.find(callback)
  return


getMetrics (err, metricsRecords) ->
  if err
    console.log err
  else
    totalHist = {}
    totalCount = 0
    for record in metricsRecords
      for slice in record.performanceData.timeSlices
        hist = slice.histogram
        if hist?
          for time, count of hist
            totalHist[time] = (totalHist[time] || 0) + count
            totalCount += count

    if false
      # Write output in CSV format.
      console.log 'dt,freq'
      for time, count of totalHist
        console.log time + ',' + (100 * count / totalCount)

    if true
      # Write summary of important stats.
      buckets = [ 60, 30, 20, 15, 0]
      coarseHist = {}
      totalTimeCount = 0
      for time, count of totalHist
        for bucket in buckets
          threshold = if bucket then 1100 / bucket else Infinity
          if time < threshold
            timeCount = time * count
            coarseHist[bucket] = (coarseHist[bucket] || 0) + timeCount
            totalTimeCount += timeCount
            break
      console.log 'fps\tpercent'
      for time, count of coarseHist
        console.log time + '\t' + (100 * count / totalTimeCount)
  process.exit()
  return
