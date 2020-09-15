# ChimeLoadTest

node threads_launcher.js <no of threads> <no of meetings to run>


Aggregation Operations
min max avg
thread wise (=> for every file)
meeting wise (across all the files && group by meeting id)


Installations on EC2 instance:

sudo yum install python3
sudo yum install python2
curl https://s3.amazonaws.com/aws-cloudwatch/downloads/latest/awslogs-agent-setup.py -O 
sudo python2 awslogs-agent-setup.py --region us-east-1 --http-proxy http://your/proxy --https-proxy http://your-proxy --no-proxy 169.254.169.254
sudo service awslogs start
sudo systemctl start awslogs
python3 -mpip install -y matplotlib 
sudo  pip3 install -y pandas

curl -sL https://rpm.nodesource.com/setup_14.x | sudo bash -
sudo yum install -y nodejs
npm i puppeteer
npm install aws-sdk
npm i getstats

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





npm run install

node worker_launcher.js







sudo yum install https://dl.fedoraproject.org/pub/epel/epel-release-latest-8.noarch.rpm
sudo yum update


----------------------------------------
ldd node_modules/puppeteer/.local-chromium/linux-782078/chrome-linux/chrome | grep not
	libgbm.so.1 => not found
	libasound.so.2 => not found
	libpangocairo-1.0.so.0 => not found
	libpango-1.0.so.0 => not found
	libcairo.so.2 => not found
	libXss.so.1 => not found
	libgtk-3.so.0 => not found
	libgdk-3.so.0 => not found
	libgdk_pixbuf-2.0.so.0 => not found
	
	