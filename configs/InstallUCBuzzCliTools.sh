cd ~
rm -rf cli
brazil ws create --name cli
cd cli
brazil ws use -p UCBuzzCliTools --versionset UCBuzzLive/live
export PATH=$PATH:`pwd`/src/UCBuzzCliTools/bin
cd ~/cli/src/UCBuzzCliTools
brazil-build release