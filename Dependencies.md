Install the following dependencies in the RedHat EC2 instance before running the program.

curl -sL https://rpm.nodesource.com/setup_14.x | sudo bash -
sudo yum install -y nodejs
sudo yum install -y git
npm i puppeteer
npm i uuid
npm install aws-sdk
npm i minimist
npm i shelljs

sudo yum install -y cups-libs dbus-glib libXrandr libXcursor libXinerama cairo cairo-gobject pango
sudo yum install -y libXrandr.*
sudo yum install -y  libatk-1.0.*
sudo yum install -y  libatk-bridge-2.0.*

sudo yum install -y  libXcomposite.*
sudo yum install -y libXcursor.*
sudo yum install -y libXdamage.*
sudo yum install -y libcups.*

sudo yum install -y libgbm.* 
sudo yum install -y libasound.*
sudo yum install -y libpangocairo-1.0.*
sudo yum install -y libpango-1.0.*
sudo yum install -y libcairo.*
sudo yum install -y libXss.*
sudo yum install -y libgtk-3.*
sudo yum install -y libgdk-3.*
sudo yum install -y libgdk_pixbuf-2.0.*

sudo yum install -y libnss3.*
sudo yum install -y libX11-xcb.*


sudo yum install -y unzip
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf awscliv2.zip
rm -rf AWSCLIV2.pkg 


----------------------------------------
Verify, that after running the above installations, the following does not appear:
$ ldd node_modules/puppeteer/.local-chromium/linux-782078/chrome-linux/chrome | grep not

	libgbm.so.1 => not found
	libasound.so.2 => not found
	libpangocairo-1.0.so.0 => not found
	libpango-1.0.so.0 => not found
	libcairo.so.2 => not found
	libXss.so.1 => not found
	libgtk-3.so.0 => not found
	libgdk-3.so.0 => not found
	libgdk_pixbuf-2.0.so.0 => not found
	
	
Install the following to use the python library and pandas

sudo yum install python3
sudo yum install python2
python3 -mpip install -y matplotlib 
sudo  pip3 install -y pandas

mkdir ChimeLoadTest .aws
sudo dnf install -y https://s3.us-east-1.amazonaws.com/amazon-ssm-us-east-1/latest/linux_amd64/amazon-ssm-agent.rpm
