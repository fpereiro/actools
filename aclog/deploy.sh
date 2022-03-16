if [ "$1" == "prod" ] ; then
   if [ "$2" != "confirm" ] && [ "$3" != "confirm" ] ; then
      echo "Must add 'confirm' to deploy to prod"
      exit 1
   fi
   HOST="root@95.216.118.115"
elif [ "$1" == "dev" ] ; then
   HOST="root@"
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

if [ "$2" == "fast" ] ; then
   cd .. && tar --exclude="$FOLDER/arch" --exclude="$FOLDER/*.swp" --exclude="$FOLDER/node_modules" --exclude="$FOLDER/.git" --exclude="$FOLDER/test" -czvf $TAR $FOLDER
else
   cd .. && tar --exclude="$FOLDER/arch" --exclude="$FOLDER/*.swp" --exclude="$FOLDER/node_modules" -czvf $TAR $FOLDER
fi
scp $TAR $HOST:
ssh $HOST tar xzvf $TAR
echo "main = node server $1" | ssh $HOST "cat >> $FOLDER/mongroup.conf"
ssh $HOST "cd $FOLDER && npm i --no-save && mg restart"
ssh $HOST rm $TAR
rm $TAR
