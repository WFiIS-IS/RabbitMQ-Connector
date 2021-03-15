//docker run -d -p 15672:15672 -p 5672:5672 --name rabbitmq rabbitmq:3-management

const amqp = require('amqplib');

class Connector {
    constructor(options) {

        this._connectionData = {
            hostname: options.hostname,
            port: options.port,
            username: options.username,
            password: options.password
        }

        this._rpcQueue = options.rpcQueue;
        this._mainQueue = options.mainQueue;
        this._connection;
        this._channel;

        this._promiseCIDs = {};
        this._events = {};
    }

    async init() {
        await this.connect();
        await this._rpcListener();

        return { channel: this._channel }
    }

    async connect() {
        try {
            this._connection = await amqp.connect({
                protocol: 'amqp',
                hostname: this._connectionData.hostname,
                port: this._connectionData.port,
                username: this._connectionData.username,
                password: this._connectionData.password,
                vhost: '/',
                authMechanism: ['PLAIN', 'AMQPLAIN', 'EXTERNAL']
            })

            this._channel = await this._connection.createChannel();
            // this._channel.prefetch(1); // how many messages at the same time
        }
        catch (err) {
            console.log('ERROR: Cannot establish RabbitMQ Connection: ', err);
        }

    }

    on(eventName, func) {
        this._events[eventName] = func;
    }

    off(eventName) {
        delete this._events[eventName];
    }

    async _rpcListener() {
        await this.createQueue(this._rpcQueue);
        await this.createQueue(this._mainQueue);

        this._channel.consume(this._rpcQueue, message => {//RPC response handler
            const data = JSON.parse(message.content.toString());
            // console.log(data);
            // if (data.rpcQueue == this._rpcQueue) {

            if (this._promiseCIDs[data.cid]) {

                this._promiseCIDs[data.cid]({
                    data: data,
                    ack: () => {
                        this.ack(message)
                    }
                });
            }
            else {
                console.log('WARNING!: Unhandled RPC');
                this.ack(message)
            }
            // }
        })

        this._channel.consume(this._mainQueue, message => {//Event handler
            const data = JSON.parse(message.content.toString());
            try {
                // let respond;
                // console.log(data);
                // if (data.type == "PUSH") {
                //     respond = (content) => {
                //         this.push(data.rpcQueue, { cid: data.id, replyQueue: data.replyQueue, content });
                //     }
                // }

                // console.log(data);
                this._events[data.event]({
                    data,
                    ack: () => {
                        this.ack(message)
                    },
                    respond: data.type != "RPC" ? null : (content) => {
                        this.push(data.rpcQueue, 'RPC_RESPONSE', content, { cid: data.id, rpcQueue: data.rpcQueue });
                    }
                });
            }
            catch (err) {
                console.log('ERROR: Unregistered Event: ', err);
            }


        })
    }


    onPush(fun) {
        this._onPush = fun;
    }


    async createQueue(name, options = {}) {
        const queue = await this._channel.assertQueue(name, options);//{durable:true} keep messages if taged as persistent after restart
        // this._queues[name] = queue;
    }

    async push(queue, event, content = {}, options = {}) {
        // console.log();
        const data = {
            type: 'PUSH',
            cid: options.cid,
            rpcQueue: options.rpcQueue,
            event,
            content

        };

        await this._channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)), { persistent: options.persistent });
    }

    async rpc(queue, event, content = {}, persistent = false, maxWaitingTimeMs = null) {
        const id = this.getUniqId();

        const data = {
            type: 'RPC',
            id,
            cid: null,
            rpcQueue: this._rpcQueue,
            event,
            content
        };

        await this._channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)), { persistent });

        return new Promise((resolve, reject) => {

            let timer;
            if (maxWaitingTimeMs) {
                timer = setTimeout(() => {
                    reject({ type: 'TIME_EXCEEDED' });
                }, maxWaitingTimeMs);
            }

            this._promiseCIDs[id] = (data) => {
                clearTimeout(timer);
                resolve(data);
            };
        })

    }

    getUniqId() {
        return Date.now() + Math.random();
    }

    ack(message) {
        this._channel.ack(message);
    }

    closeConnection() {
        console.log('\n RabbitMQ closing connection...');
        this._connection.close();
    }


}

module.exports = Connector;
