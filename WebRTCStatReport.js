export default class WebRTCStatReport {
  constructor(realTimeMetricAggregate) {
    this.realTimeMetricAggregate = realTimeMetricAggregate;
    
    this.audioDecoderLossTotal = 0;
    this.audioPacketsReceivedTotal = 0;
    this.audioPacketsReceivedFractionLossTotal = 0;
    this.audioSpeakerDelayMsTotal = 0;
    this.availableReceiveBandwidthTotal = 0;
    this.totalReadings = 0;

    this.audioDecoderLossMinMax = [];
    this.audioPacketsReceivedMinMax = [];
    this.audioPacketsReceivedFractionLossMinMax = [];
    this.audioSpeakerDelayMsMinMax = [];
    this.availableReceiveBandwidthMinMax = [];

    this.audioDecoderLossAvg = 0;
    this.audioPacketsReceivedAvg = 0;
    this.audioPacketsReceivedFractionLossAvg = 0;
    this.audioSpeakerDelayMsAvg = 0;
    this.availableReceiveBandwidthAvg = 0;
  }

  individualThreadWebRTCAvgReading(webRTCStatReport) {
    if (this.realTimeMetricAggregate) {
      const threadWebRTCStatReport = webRTCStatReport[workerData.threadId];
      const totalReadingsByWorkerThread = threadWebRTCStatReport.totalReadings;
      if (threadWebRTCStatReport.totalReadings > 0) {
        threadWebRTCStatReport.audioDecoderLossAvg = threadWebRTCStatReport.audioDecoderLossTotal / totalReadingsByWorkerThread;
        threadWebRTCStatReport.audioPacketsReceivedAvg = threadWebRTCStatReport.audioPacketsReceivedTotal / totalReadingsByWorkerThread;
        threadWebRTCStatReport.audioPacketsReceivedFractionLossAvg = threadWebRTCStatReport.audioPacketsReceivedFractionLossTotal / totalReadingsByWorkerThread;
        threadWebRTCStatReport.audioSpeakerDelayMsAvg = threadWebRTCStatReport.audioSpeakerDelayMsTotal / totalReadingsByWorkerThread;
        threadWebRTCStatReport.availableReceiveBandwidthAvg = threadWebRTCStatReport.availableReceiveBandwidthTotal / totalReadingsByWorkerThread;
      } else {
        console.log(workerData.threadId + 'threadReadings is 0 0000000 ');
      }
    }
  }

  writeMetric(metricReport, webRTCStatReport) {
    if (this.realTimeMetricAggregate) {
      let metricsStr = '[';
      const workerDataThreadId = workerData.threadId;
      const webRTCStatReportWorkerThread = webRTCStatReport[workerDataThreadId];

      if (typeof (metricReport.audioDecoderLoss) !== 'undefined') {
        const metricReportAudioDecoderLoss = metricReport.audioDecoderLoss;
        metricsStr += 'audioDecoderLoss: ' + metricReportAudioDecoderLoss + '; ';
        webRTCStatReportWorkerThread.audioDecoderLossTotal += metricReportAudioDecoderLoss;

        webRTCStatReportWorkerThread.audioDecoderLossMinMax[0] = !webRTCStatReportWorkerThread.audioDecoderLossMinMax[0] ? metricReportAudioDecoderLoss : Math.min(webRTCStatReportWorkerThread.audioDecoderLossMinMax[0], metricReportAudioDecoderLoss);
        webRTCStatReportWorkerThread.audioDecoderLossMinMax[1] = !webRTCStatReportWorkerThread.audioDecoderLossMinMax[1] ? metricReportAudioDecoderLoss : Math.max(webRTCStatReportWorkerThread.audioDecoderLossMinMax[1], metricReportAudioDecoderLoss);
      }

      if (typeof (metricReport.audioPacketsReceived) !== 'undefined') {
        const metricReportAudioPacketsReceived = metricReport.audioPacketsReceived;
        metricsStr += 'audioPacketsReceived: ' + metricReportAudioPacketsReceived + '; ';
        webRTCStatReportWorkerThread.audioPacketsReceivedTotal += metricReportAudioPacketsReceived;

        webRTCStatReportWorkerThread.audioPacketsReceivedMinMax[0] = !webRTCStatReportWorkerThread.audioPacketsReceivedMinMax[0] ? metricReportAudioPacketsReceived : Math.min(webRTCStatReportWorkerThread.audioPacketsReceivedMinMax[0], metricReportAudioPacketsReceived);
        webRTCStatReportWorkerThread.audioPacketsReceivedMinMax[1] = !webRTCStatReportWorkerThread.audioPacketsReceivedMinMax[1] ? metricReportAudioPacketsReceived : Math.max(webRTCStatReportWorkerThread.audioPacketsReceivedMinMax[1], metricReportAudioPacketsReceived);

      }
      if (typeof (metricReport.audioPacketsReceivedFractionLoss) !== 'undefined') {
        const metricReportAudioPacketsReceivedFractionLoss = metricReport.audioPacketsReceivedFractionLoss;
        metricsStr += 'audioPacketsReceivedFractionLoss: ' + metricReportAudioPacketsReceivedFractionLoss + '; ';
        webRTCStatReportWorkerThread.audioPacketsReceivedFractionLossTotal += metricReportAudioPacketsReceivedFractionLoss;

        webRTCStatReportWorkerThread.audioPacketsReceivedFractionLossMinMax[0] = !webRTCStatReportWorkerThread.audioPacketsReceivedFractionLossMinMax[0] ? metricReportAudioPacketsReceivedFractionLoss : Math.min(webRTCStatReportWorkerThread.audioPacketsReceivedFractionLossMinMax[0], metricReportAudioPacketsReceivedFractionLoss);
        webRTCStatReportWorkerThread.audioPacketsReceivedFractionLossMinMax[1] = !webRTCStatReportWorkerThread.audioPacketsReceivedFractionLossMinMax[1] ? metricReportAudioPacketsReceivedFractionLoss : Math.max(webRTCStatReportWorkerThread.audioPacketsReceivedFractionLossMinMax[1], metricReportAudioPacketsReceivedFractionLoss);
      }
      if (typeof (metricReport.audioSpeakerDelayMs) !== 'undefined') {
        const metricReportAudioSpeakerDelayMs = metricReport.audioSpeakerDelayMs;
        metricsStr += 'audioSpeakerDelayMs: ' + metricReportAudioSpeakerDelayMs + '; ';
        webRTCStatReportWorkerThread.audioSpeakerDelayMsTotal += metricReportAudioSpeakerDelayMs;

        webRTCStatReportWorkerThread.audioSpeakerDelayMsMinMax[0] = !webRTCStatReportWorkerThread.audioSpeakerDelayMsMinMax[0] ? metricReportAudioSpeakerDelayMs : Math.min(webRTCStatReportWorkerThread.audioSpeakerDelayMsMinMax[0], metricReportAudioSpeakerDelayMs);
        webRTCStatReportWorkerThread.audioSpeakerDelayMsMinMax[1] = !webRTCStatReportWorkerThread.audioSpeakerDelayMsMinMax[1] ? metricReportAudioSpeakerDelayMs : Math.max(webRTCStatReportWorkerThread.audioSpeakerDelayMsMinMax[1], metricReportAudioSpeakerDelayMs);
      }
      if (typeof (metricReport.availableReceiveBandwidth) !== 'undefined') {
        const metricReportAvailableReceiveBandwidth = metricReport.availableReceiveBandwidth;
        metricsStr += 'availableReceiveBandwidth: ' + metricReportAvailableReceiveBandwidth + '; ';
        webRTCStatReportWorkerThread.availableReceiveBandwidthTotal += metricReportAvailableReceiveBandwidth;

        webRTCStatReportWorkerThread.availableReceiveBandwidthMinMax[0] = !webRTCStatReportWorkerThread.availableReceiveBandwidthMinMax[0] ? metricReportAvailableReceiveBandwidth : Math.min(webRTCStatReportWorkerThread.availableReceiveBandwidthMinMax[0], metricReportAvailableReceiveBandwidth);
        webRTCStatReportWorkerThread.availableReceiveBandwidthMinMax[1] = !webRTCStatReportWorkerThread.availableReceiveBandwidthMinMax[1] ? metricReportAvailableReceiveBandwidth : Math.max(webRTCStatReportWorkerThread.availableReceiveBandwidthMinMax[1], metricReportAvailableReceiveBandwidth);
      }

      metricsStr += ']';
      if (metricsStr.length > 3) {
        webRTCStatReportWorkerThread.totalReadings += 1;
      }
      return metricsStr;
    }
  }

  aggregationOperation(rtcStatReport, threadStatReport) {
    if (this.realTimeMetricAggregate) {
      rtcStatReport.audioDecoderLossAvg += threadStatReport.audioDecoderLossAvg;
      rtcStatReport.audioPacketsReceivedAvg += threadStatReport.audioPacketsReceivedAvg;
      rtcStatReport.audioPacketsReceivedFractionLossAvg += threadStatReport.audioPacketsReceivedFractionLossAvg;
      rtcStatReport.audioSpeakerDelayMsAvg += threadStatReport.audioSpeakerDelayMsAvg;
      rtcStatReport.availableReceiveBandwidthAvg += threadStatReport.availableReceiveBandwidthAvg;
      rtcStatReport.totalReadings += threadStatReport.totalReadings;

      console.log('audioDecoderLoss MinMax: ' + threadStatReport.audioDecoderLossMinMax);
      console.log('audioPacketsReceived MinMax: ' + threadStatReport.audioPacketsReceivedMinMax);
      console.log('audioPacketsReceivedFractionLoss MinMax: ' + threadStatReport.audioPacketsReceivedFractionLossMinMax);
      console.log('audioSpeakerDelayMs MinMax: ' + threadStatReport.audioSpeakerDelayMsMinMax);
      console.log('availableReceiveBandwidth MinMax: ' + threadStatReport.availableReceiveBandwidthMinMax);

      console.log(' -------- - - - --------------------- - - - ---------------------');
      console.log('audioDecoderLoss MinMax: ' + rtcStatReport.audioDecoderLossMinMax);
      console.log('audioPacketsReceived MinMax: ' + rtcStatReport.audioPacketsReceivedMinMax);
      console.log('audioPacketsReceivedFractionLoss MinMax: ' + rtcStatReport.audioPacketsReceivedFractionLossMinMax);
      console.log('audioSpeakerDelayMs MinMax: ' + rtcStatReport.audioSpeakerDelayMsMinMax);
      console.log('availableReceiveBandwidth MinMax: ' + rtcStatReport.availableReceiveBandwidthMinMax);

      rtcStatReport.audioDecoderLossMinMax[0] = !rtcStatReport.audioDecoderLossMinMax[0] ? threadStatReport.audioDecoderLossMinMax[0] : Math.min(rtcStatReport.audioDecoderLossMinMax[0], threadStatReport.audioDecoderLossMinMax[0]);
      rtcStatReport.audioDecoderLossMinMax[1] = !rtcStatReport.audioDecoderLossMinMax[1] ? threadStatReport.audioDecoderLossMinMax[1] : Math.max(rtcStatReport.audioDecoderLossMinMax[1], threadStatReport.audioDecoderLossMinMax[1]);

      rtcStatReport.audioPacketsReceivedMinMax[0] = !rtcStatReport.audioPacketsReceivedMinMax[0] ? threadStatReport.audioPacketsReceivedMinMax[0] : Math.min(rtcStatReport.audioPacketsReceivedMinMax[0], threadStatReport.audioPacketsReceivedMinMax[0]);
      rtcStatReport.audioPacketsReceivedMinMax[1] = !rtcStatReport.audioPacketsReceivedMinMax[1] ? threadStatReport.audioPacketsReceivedMinMax[1] : Math.max(rtcStatReport.audioPacketsReceivedMinMax[1], threadStatReport.audioPacketsReceivedMinMax[1]);

      rtcStatReport.audioPacketsReceivedFractionLossMinMax[0] = !rtcStatReport.audioPacketsReceivedFractionLossMinMax[0] ? threadStatReport.audioPacketsReceivedFractionLossMinMax[0] : Math.min(rtcStatReport.audioPacketsReceivedFractionLossMinMax[0], threadStatReport.audioPacketsReceivedFractionLossMinMax[0]);
      rtcStatReport.audioPacketsReceivedFractionLossMinMax[1] = !rtcStatReport.audioPacketsReceivedFractionLossMinMax[1] ? threadStatReport.audioPacketsReceivedFractionLossMinMax[1] : Math.max(rtcStatReport.audioPacketsReceivedFractionLossMinMax[1], threadStatReport.audioPacketsReceivedFractionLossMinMax[1]);

      rtcStatReport.audioSpeakerDelayMsMinMax[0] = !rtcStatReport.audioSpeakerDelayMsMinMax[0] ? threadStatReport.audioSpeakerDelayMsMinMax[0] : Math.min(rtcStatReport.audioSpeakerDelayMsMinMax[0], threadStatReport.audioSpeakerDelayMsMinMax[0]);
      rtcStatReport.audioSpeakerDelayMsMinMax[1] = !rtcStatReport.audioSpeakerDelayMsMinMax[1] ? threadStatReport.audioSpeakerDelayMsMinMax[1] : Math.max(rtcStatReport.audioSpeakerDelayMsMinMax[1], threadStatReport.audioSpeakerDelayMsMinMax[1]);

      rtcStatReport.availableReceiveBandwidthMinMax[0] = !rtcStatReport.availableReceiveBandwidthMinMax[0] ? threadStatReport.availableReceiveBandwidthMinMax[0] : Math.min(rtcStatReport.availableReceiveBandwidthMinMax[0], threadStatReport.availableReceiveBandwidthMinMax[0]);
      rtcStatReport.availableReceiveBandwidthMinMax[1] = !rtcStatReport.availableReceiveBandwidthMinMax[1] ? threadStatReport.availableReceiveBandwidthMinMax[1] : Math.max(rtcStatReport.availableReceiveBandwidthMinMax[1], threadStatReport.availableReceiveBandwidthMinMax[1]);

      console.log(' --------  - - - --------------------- - - - ---------------------');
      console.log('audioDecoderLoss MinMax: ' + rtcStatReport.audioDecoderLossMinMax);
      console.log('audioPacketsReceived MinMax: ' + rtcStatReport.audioPacketsReceivedMinMax);
      console.log('audioPacketsReceivedFractionLoss MinMax: ' + rtcStatReport.audioPacketsReceivedFractionLossMinMax);
      console.log('audioSpeakerDelayMs MinMax: ' + rtcStatReport.audioSpeakerDelayMsMinMax);
      console.log('availableReceiveBandwidth MinMax: ' + rtcStatReport.availableReceiveBandwidthMinMax);
    }
  }

  printRTCStatReport(rtcStatReport, threadCount) {
    if (this.realTimeMetricAggregate) {
      const totalReadings = rtcStatReport.totalReadings;
      console.log('totalReadings: ' + totalReadings);
      console.log('audioDecoderLoss Avg: ' + rtcStatReport.audioDecoderLossAvg / threadCount);
      console.log('audioPacketsReceived Avg: ' + rtcStatReport.audioPacketsReceivedAvg / threadCount);
      console.log('audioPacketsReceivedFractionLoss Avg: ' + rtcStatReport.audioPacketsReceivedFractionLossAvg / threadCount);
      console.log('audioSpeakerDelayMs Avg: ' + rtcStatReport.audioSpeakerDelayMsAvg / threadCount);
      console.log('availableReceiveBandwidth Avg: ' + rtcStatReport.availableReceiveBandwidthAvg / threadCount);

      console.log('totalReadings: ' + totalReadings);
      console.log('audioDecoderLoss MinMax: ' + rtcStatReport.audioDecoderLossMinMax);
      console.log('audioPacketsReceived MinMax: ' + rtcStatReport.audioPacketsReceivedMinMax);
      console.log('audioPacketsReceivedFractionLoss MinMax: ' + rtcStatReport.audioPacketsReceivedFractionLossMinMax);
      console.log('audioSpeakerDelayMs MinMax: ' + rtcStatReport.audioSpeakerDelayMsMinMax);
      console.log('availableReceiveBandwidth MinMax: ' + rtcStatReport.availableReceiveBandwidthMinMax);
    }
  }}
