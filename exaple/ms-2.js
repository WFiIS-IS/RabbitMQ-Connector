

const Connector = require('./Connector');


let connector = new Connector({
    hostname: 'localhost',
    port: '5672',
    username: 'guest',
    password: 'guest',
    mainQueue: 'ms2-queue',
    rpcQueue: 'ms2-queue-rpc'
});

const connect = async () => {
    await connector.init()

    connector.on('connection-check', ({ data, ack, respond }) => {
        console.log(data);
        if (data.type == "RPC") {
            respond({ message: 'OK' });
        }

        ack();
    })
}
connect();


process.on('SIGINT', function () {
    connector.closeConnection();
    process.exit(1);
});

//-------------------------------------
let i = 0;
setInterval(() => {
    console.log('Time: ', i++);
}, 1000)