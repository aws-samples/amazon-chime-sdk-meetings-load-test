Install the following dependencies before running the tool.

##On LocalMachine - Mac/PC or dev desktops:

While running the command `npm install` should automatically install the dependencies referenced in the package.json file, the following can be installed manually as well. 
- curl -sL https://rpm.nodesource.com/setup_14.x | sudo bash -
- sudo yum install -y nodejs
- sudo yum install -y git
- npm i puppeteer
- npm i uuid
- npm install aws-sdk
- npm i minimist
- npm i shelljs
- npm i aws-embedded-metrics

##On EC2 instances (tested on RedHat):
- sudo yum install -y cups-libs dbus-glib libXrandr libXcursor libXinerama cairo cairo-gobject pango
- sudo yum install -y libXrandr._
- sudo yum install -y libatk-1.0._
- sudo yum install -y libatk-bridge-2.0.\*

- sudo yum install -y libXcomposite._
- sudo yum install -y libXcursor._
- sudo yum install -y libXdamage._
- sudo yum install -y libcups._

- sudo yum install -y libgbm._
- sudo yum install -y libasound._
- sudo yum install -y libpangocairo-1.0._
- sudo yum install -y libpango-1.0._
- sudo yum install -y libcairo._
- sudo yum install -y libXss._
- sudo yum install -y libgtk-3._
- sudo yum install -y libgdk-3._
- sudo yum install -y libgdk_pixbuf-2.0.\*

- sudo yum install -y libnss3._
- sudo yum install -y libX11-xcb._


---

Verify, that after running the above installations, the following does not appear:
\$ ldd node_modules/puppeteer/.local-chromium/linux-782078/chrome-linux/chrome | grep not

    libgbm.so.1 => not found
    libasound.so.2 => not found
    libpangocairo-1.0.so.0 => not found
    libpango-1.0.so.0 => not found
    libcairo.so.2 => not found
    libXss.so.1 => not found
    libgtk-3.so.0 => not found
    libgdk-3.so.0 => not found
    libgdk_pixbuf-2.0.so.0 => not found
