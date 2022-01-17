const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const HardwareSchema = new mongoose.Schema({
    hardware: { type: String }, // Наименование оборудование
    producer: { type: String }, // Производитель
    model: { type: String }, // модель оборудование
    number: { type: String }, // инветаризационный номер
    location: { type: String }, // расположение оборудование
    replaced: { type: String }, // Заменен
    details: [{ type: mongoose.Schema.Types.ObjectId }], // запчасти
    characteristic: { type: String }, // Характиристки
    state: { type: String } // состояние
});

module.exports = mongoose.model('Hardware', HardwareSchema);