# RabbitMQ-Connector
Klasa implementująca RPC w RabbitMQ.


Mając zainstalowanego dockera uruchamiamy kontener z rabbitmq
> docker run -d -p 15672:15672 -p 5672:5672 --name rabbitmq rabbitmq:3-management

localhost:15672 - strona admina. 
username:guest
password:guest

Connector.js wymaga amqplib.
Instalacja: > npm install amqplib

