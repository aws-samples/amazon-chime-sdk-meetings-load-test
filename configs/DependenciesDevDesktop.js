const shell = require('shelljs');
shell.exec(`pwd && cd ../configs/ && pwd && sudo chmod 777 InstallSAM.sh`);
shell.exec(`bash ../ChimeLoadTest/configs/InstallSAM.sh`);

shell.exec(`pwd && cd ../configs/ && pwd && sudo chmod 777 InstallUCBuzzCliTools.sh`);
shell.exec(`bash ../ChimeLoadTest/configs/InstallUCBuzzCliTools.sh`);
