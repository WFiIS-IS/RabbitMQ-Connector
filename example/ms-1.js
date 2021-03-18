

const Connector = require('./Connector');


const connector = new Connector({
    hostname: 'localhost',
    port: '5672',
    username: 'guest',
    password: 'guest',
    mainQueue: 'ms1-queue',
    rpcQueue: 'ms1-queue-rpc',
});

connector.init()
    .then(async ({ channel }) => {

        setInterval(async () => {

            // await connector.push('ms2-queue', 'myPushEvent', {
            //     message: 'Ms-1 Connected ' + new Date().valueOf()
            // }); //OR

            await connector.rpc('ms2-queue', 'myRpcEvent', {
                message: 'Ms-1 Connected ' + new Date().valueOf()
            })
                .then(({ data, ack }) => {
                    console.log('RPC Response calls Promise.resolve');
                    console.log(data);
                    ack();//removes message from queue

                })
                .catch((err) => {
                    console.log(err);
                });


        }, 500);

    })
    .catch(err => {
        console.log(err);
        process.exit(1);
    })


process.on('SIGINT', function () {
    connector.closeConnection();
    process.exit(1);
});