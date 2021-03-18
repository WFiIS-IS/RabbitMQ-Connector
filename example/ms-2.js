

const Connector = require('./Connector');


const connector = new Connector({
    hostname: 'localhost',
    port: '5672',
    username: 'guest',
    password: 'guest',
    mainQueue: 'ms2-queue',
    rpcQueue: 'ms2-queue-rpc'
});

const connect = async () => {
    try {
        await connector.init();
    }
    catch (err) {
        console.log(err);
        process.exit(1);
    }


    connector.on('myPushEvent', ({ data, ack }) => {
        console.log(data);

        ack();//removes message from queue
    });

    connector.on('myRpcEvent', ({ data, ack, respond }) => {
        console.log(data);

        if (data.type == "RPC") {
            respond({ message: 'OK' });
        }

        ack();//removes message from queue
    });

    connector.on('unregistered', ({ data, ack }) => {//handling unregistered events
        console.log('Unregistered Event');
        ack();
    });

}
connect();


process.on('SIGINT', function () {
    connector.closeConnection();
    process.exit(1);
});