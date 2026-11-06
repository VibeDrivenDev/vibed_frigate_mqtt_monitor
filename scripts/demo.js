const net = require('net');
const { Aedes } = require('aedes');
const mqtt = require('mqtt');

const cameras = (process.argv[2] || 'front_door,garage,side_gate').split(',');

(async () => {
  const aedes = await Aedes.createBroker();
  net.createServer(aedes.handle).listen(18830, () => {
    console.log('demo broker on port 18830. Run: SURVEILLANCE_CONFIG=scripts/demo-config.json npm start');
    const c = mqtt.connect('mqtt://127.0.0.1:18830');
    c.on('connect', () => {
      cameras.forEach((cam, i) => {
        const send = (type) =>
          c.publish('frigate/events', JSON.stringify({ type, after: { id: `demo-${cam}`, camera: cam, label: 'person' } }));
        setTimeout(() => { send('new'); console.log('new', cam); }, 4000 + i * 2000);
        setTimeout(() => { send('end'); console.log('end', cam); }, 14000 + i * 3000);
      });
    });
  });
})();
