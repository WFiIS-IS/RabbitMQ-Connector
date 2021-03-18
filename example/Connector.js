
const amqp = require('amqplib');

class Connector {
    #connection;
    #connectionData;
    #rpcQueue;
    #mainQueue;
    #channel;
    #promiseCIDs = {};
    #events = {};

    constructor(options) {

        this.#connectionData = {
            hostname: options.hostname,
            port: options.port,
            username: options.username,
            password: options.password
        }

        this.#rpcQueue = options.rpcQueue;
        this.#mainQueue = options.mainQueue;

        if (options.mainQueue === options.rpcQueue) {
            throw new Error('Main and Rpc queues cannot have the same names. Feature is not implemented yet.');
        }
    }

    async init() {
        await this.connect();
        await this.rpcListener();

        return { channel: this.#channel };
    }

    async connect() {
        try {
            this.#connection = await amqp.connect({
                protocol: 'amqp',
                hostname: this.#connectionData.hostname,
                port: this.#connectionData.port,
                username: this.#connectionData.username,
                password: this.#connectionData.password,
                vhost: '/',
                authMechanism: ['PLAIN', 'AMQPLAIN', 'EXTERNAL']
            })

            this.#channel = await this.#connection.createChannel();
            // this.#channel.prefetch(1); // how many messages at the same time
        }
        catch (err) {
            throw err;
        }

    }

    on(eventName, func) {
        if (this.#events[eventName]) {
            throw new Error('Event already registered');
        }
        this.#events[eventName] = func;
    }

    off(eventName) {
        delete this.#events[eventName];
    }

    async rpcListener() {
        await this.createQueue(this.#rpcQueue);
        await this.createQueue(this.#mainQueue);

        this.#channel.consume(this.#rpcQueue, message => {//RPC response handler
            const data = JSON.parse(message.content.toString());

            if (this.#promiseCIDs[data.cid]) {

                this.#promiseCIDs[data.cid]({
                    data: data,
                    ack: () => {
                        this.ack(message)
                    }
                });
            }
            else {
                console.warn('Warning: Unhandled RPC.');
                this.ack(message);
            }

        })

        this.#channel.consume(this.#mainQueue, message => {//Event handler
            const data = JSON.parse(message.content.toString());

            if (this.#events[data.event]) {

                this.#events[data.event]({
                    data,
                    ack: () => {
                        this.ack(message)
                    },
                    respond: data.type != "RPC" ? null : (content) => {
                        this.push(data.rpcQueue, 'RPC_RESPONSE', content, { cid: data.id, rpcQueue: data.rpcQueue });
                    }
                });

            }
            else if (this.#events['unregistered']) {

                this.#events['unregistered']({
                    data,
                    ack: () => {
                        this.ack(message)
                    },
                    respond: data.type != "RPC" ? null : (content) => {
                        this.push(data.rpcQueue, 'RPC_RESPONSE', content, { cid: data.id, rpcQueue: data.rpcQueue });
                    }
                })
            }
            else {
                console.warn('Warning: Unregistered Event.');
                this.ack(message);
            }

        })
    }

    async createQueue(name, options = {}) {
        const queue = await this.#channel.assertQueue(name, options);//{durable:true} keep messages if taged as persistent after restart
    }

    async push(queue, event, content = {}, options = {}) {

        const data = {
            type: 'PUSH',
            cid: options.cid,
            rpcQueue: options.rpcQueue,
            event,
            content
        };

        await this.#channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)), { persistent: options.persistent });
    }

    async rpc(queue, event, content = {}, persistent = false, maxWaitingTimeMs = null) {
        const id = this.getUniqId();

        const data = {
            type: 'RPC',
            id,
            cid: null,
            rpcQueue: this.#rpcQueue,
            event,
            content
        };

        await this.#channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)), { persistent });

        return new Promise((resolve, reject) => {

            let timer;
            if (maxWaitingTimeMs) {
                timer = setTimeout(() => {
                    reject(new Error('TIME_EXCEEDED'));
                    delete this.#promiseCIDs[id];
                }, maxWaitingTimeMs);
            }

            this.#promiseCIDs[id] = (data) => {
                clearTimeout(timer);
                resolve(data);
                delete this.#promiseCIDs[id];
            };
        })

    }

    getUniqId() {
        return Date.now() + Math.random();
    }

    ack(message) {
        this.#channel.ack(message);
    }

    closeConnection() {
        console.log('\nClosing connection with RabbitMQ...');
        this.#connection.close();
    }

}

module.exports = Connector;
