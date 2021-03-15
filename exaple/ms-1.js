

const Connector = require('./Connector');


const connector = new Connector({
    hostname: 'localhost',
    port: '5672',
    username: 'guest',
    password: 'guest',
    mainQueue: 'ms1-queue',
    rpcQueue: 'ms1-queue-rpc',
});

connector.init().then(async (channel) => {

    setInterval(async () => {
        // await connector.push('ms2-queue', 'connection-check', {
        //     message: 'Ms-1 Connected ' + new Date().valueOf()
        // });



        await connector.rpc('ms2-queue', 'connection-check', {
            message: 'Ms-1 Connected ' + new Date().valueOf()
        }).then(({ data, ack }) => {
            console.log('Promise resolve');
            console.log(data);

            ack();

        }).catch((err) => {
            console.log('CZAS PRZKROZONO');
        })

    }, 1000)


})

process.on('SIGINT', function () {
    connector.closeConnection();
    process.exit(1);
});

//-------------------------------------
let i = 0;
setInterval(() => {
    console.log('Time: ', i++);
}, 1000)