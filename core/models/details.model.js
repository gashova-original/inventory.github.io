const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const DetailSchema = new mongoose.Schema({
    name: { type: String }, // Наименование запчасти
    producer: { type: String }, // Производитель
    specifications: { type: String }, // Характиристики
    comments: { type: String } // Комментарии
});

module.exports = mongoose.model('Detail', DetailSchema);