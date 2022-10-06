if [ "$1" == "prod" ] ; then
   if [ "$2" != "confirm" ] && [ "$3" != "confirm" ] ; then
      echo "Must add 'confirm' to deploy to prod"
      exit 1
   fi
   HOST="root@95.216.118.115"
elif [ "$1" == "dev" ] ; then
   HOST="root@136.243.174.166"
else
   echo "Must specify environment (dev|prod)"
   exit 1
fi

FOLDER="aclog"
TAR="aclog.tar.gz"

if [ "$2" == "client" ] ; then
   scp client.js $HOST:$FOLDER
   exit 0
fi

if [ "$2" == "server" ] ; then
   scp server.js $HOST:$FOLDER
   ssh $HOST "cd $FOLDER && mg restart"
   exit 0
fi

rsync -av . $HOST:$FOLDER
ssh $HOST chown -R root /root/$FOLDER
echo "main = node server $1" | ssh $HOST "cat >> $FOLDER/mongroup.conf"
ssh $HOST "cd $FOLDER && npm i --no-save --omit=dev && mg restart"
