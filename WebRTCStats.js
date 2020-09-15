
export default class WebRTCStatReport {
  constructor() {
    this.audioDecoderLossTotal = 0;
    this.audioPacketsReceivedTotal = 0;
    this.audioPacketsReceivedFractionLossTotal = 0;
    this.audioSpeakerDelayMsTotal = 0;
    this.availableReceiveBandwidthTotal = 0;
    // this.availableSendBandwidthTotal = 0;
    this.totalReadings = 0;

    this.audioDecoderLossMinMax = [];
    this.audioPacketsReceivedMinMax = [];
    this.audioPacketsReceivedFractionLossMinMax = [];
    this.audioSpeakerDelayMsMinMax = [];
    this.availableReceiveBandwidthMinMax = [];
    //this.availableSendBandwidthMinMax = [0,0];

    this.audioDecoderLossAvg = 0;
    this.audioPacketsReceivedAvg = 0;
    this.audioPacketsReceivedFractionLossAvg = 0;
    this.audioSpeakerDelayMsAvg = 0;
    this.availableReceiveBandwidthAvg = 0;
    //this.availableSendBandwidthAvg = 0;
  }
}