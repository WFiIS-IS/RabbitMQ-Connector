//docker run -d -p 15672:15672 -p 5672:5672 --name rabbitmq rabbitmq:3-management

const amqp = require('amqplib');


connect();

async function connect() {
    try {
        //producer
        const connection = await amqp.connect({
            protocol: 'amqp',
            hostname: 'localhost',
            port: '5672',
            username: 'guest',
            password: 'guest',
            vhost: '/',
            authMechanism: ['PLAIN', 'AMQPLAIN', 'EXTERNAL']
        })

        const channel = await connection.createChannel()
        console.log(connection);
        const res = await channel.assertQueue('queue-ds');
        console.log(res);

        const msgs = [
            { name: 'Adam1', message: 'AAAAAAAAA1' },
            { name: 'Adam2', message: 'AAAAAAAAA2' },
            { name: 'Adam3', message: 'AAAAAAAAA3' },
            { name: 'Adam4', message: 'AAAAAAAAA4' }
        ]

        for (let msg of msgs) {
            await channel.sendToQueue('queue-ds', Buffer.from(JSON.stringify(msg)));
            console.log('Send Message');
        }

        //consumer
        channel.consume('queue-ds', message => {
            const data = JSON.parse(message.content.toString());
            console.log(data);
            channel.ack(message)//delete from queue
        })
    }
    catch (err) {
        console.log(err);
    }
}