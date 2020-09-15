import glob
import pandas as pd

#pd.set_option('display.max_rows', 500)

directoryPath = '/Users/ridip/ChimeLoadTest/MeetingsDirectory_2020-09-09T05:02:04.350Z'
# h represents the meeting id

colList = ['audioPacketsReceived', 'audioDecoderLoss', 'audioPacketsReceivedFractionLoss', 'audioSpeakerDelayMs', 'availableSendBandwidth', 'attendeeId','meetingId']

csvFileList = glob.glob(directoryPath+'/*.csv')

dfList = []

for fname in csvFileList:
    df = pd.read_csv(fname, usecols=colList[:-1])
    meetingId = (fname.split('/')[-1]).split('.')[-2]
    df['meetingId'] = meetingId
    dfList.append(df)


combined_df = pd.concat(dfList)
#removing rows with all 0 stats
combined_df_clean = combined_df.loc[combined_df['availableSendBandwidth'] > 0]
#all non zero rows
print(combined_df_clean)

aggregate_operations = {"audioPacketsReceived": [min, max],
                        "audioDecoderLoss": [min, max],
                        "audioPacketsReceivedFractionLoss": [min, max],
                        "audioSpeakerDelayMs": [min, max],
                        "availableSendBandwidth": [min, max]}


# #mean for each attendee
mean_stats_attendees = combined_df_clean.groupby(['attendeeId']).mean()
print(mean_stats_attendees)

# #MinMax for each attendee
min_max_stats_attendees = combined_df_clean.groupby('attendeeId').agg(aggregate_operations) 
min_max_stats_attendees.columns = ["_".join(x) for x in min_max_stats_attendees.columns.ravel()]
print(min_max_stats_attendees)


#mean for each meeting session
mean_stats_meetings = combined_df_clean.groupby(['meetingId']).mean()
print(mean_stats_meetings)

#MinMax for each meeting session
min_max_stats_meetings = combined_df_clean.groupby('meetingId').agg(aggregate_operations) 
min_max_stats_meetings.columns = ["_".join(x) for x in min_max_stats_meetings.columns.ravel()]
print(min_max_stats_meetings)




min_max_stats_attendees[['audioPacketsReceived_min','audioPacketsReceived_max']].plot(kind='line',rot=90);
min_max_stats_attendees[['audioDecoderLoss_min','audioDecoderLoss_max']].plot(kind='line',rot=90);
min_max_stats_attendees[['audioPacketsReceivedFractionLoss_min','audioPacketsReceivedFractionLoss_max']].plot(kind='line',rot=90);
min_max_stats_attendees[['audioSpeakerDelayMs_min','audioSpeakerDelayMs_max']].plot(kind='line',rot=90);
min_max_stats_attendees[['availableSendBandwidth_min','availableSendBandwidth_max']].plot(kind='line',rot=90);

min_max_stats_meetings[['audioPacketsReceived_min','audioPacketsReceived_max']].plot(kind='line',rot=90);
min_max_stats_meetings[['audioDecoderLoss_min','audioDecoderLoss_max']].plot(kind='line',rot=90);
min_max_stats_meetings[['audioPacketsReceivedFractionLoss_min','audioPacketsReceivedFractionLoss_max']].plot(kind='line',rot=90);
min_max_stats_meetings[['audioSpeakerDelayMs_min','audioSpeakerDelayMs_max']].plot(kind='line',rot=90);
import matplotlib.pyplot as plt
min_max_stats_meetings[['availableSendBandwidth_min','availableSendBandwidth_max']].plot(kind='line',rot=90)
plt.show(block=True)