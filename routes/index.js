const express = require('express');
const mongoose = require('mongoose');
const Hardware = require('../core/models/hardware.model');
const Detail = require('../core/models/details.model');
const router = express.Router();
require('../config')

async function loadHardwares(req, res, next) { // Функция запроса оборудование
	let obj = {};
	if (req.params.number !== undefined) { // Проверка параметр инв. номера (http://site/number)
	    if(req.params.number === 'details') { // если number === 'details'
	        req.data = []; // инициализация ответа
            return next(); // передаем управление следующему обработчику (middleware)
        }
		obj = {'number': req.params.number}; // Установим параметр для запроса оборудование (по инв. номеру)
	}
	req.data = await Hardware.find(obj); // Запрашиваем у БД оборудование
    req.data = req.data.filter((obj) => obj.number !== 'details'); // фильтруем объекты с инв. номером == 'details'
    next(); // передаем управление следующему обработчику (middleware)
}

async function loadDetails(req, res, next) { // Функция запроса запчастей
	req.details = [] // Готовим пустой массив
	
	if(req.data === undefined) return next(); // Если нету ни одного обордованеие то передаем управление дальше
	if(req.data.length === 0) return next(); // Если нет оборудование то передаем управление дальше
	if(req.data.length > 1) return next(); // Если более одного оборудование то передаем управление дальше
	if(req.data[0] === undefined) return next(); // Если перый элемент пустой то передаем управление дальше
	if(req.data[0].details === undefined) return next(); // Если оборудование не имеет поле деталей
	if(req.data[0].details.length === 0) return next(); // Если оборудование не имеет деталей

	let obj = {_id: {$in: req.data[0].details}}; // Запрашиваем все детали входящий в оборудование
	req.details = await Detail.find(obj); // Запрашиваем у БД
    next(); // передаем управление следующему обработчику (middleware)
}

/*
* Пример запроса: GET http://localhost:3000/number/detail
* Где number - инв. номер, detail - идентификатор запчасти
* Оба параметра не обязательны (знак ? после параметра)
* Т.е на этот путь можно попасть просто введя http://localhost:3000/
* что соответственно выведет весь список оборудование.
*/
router.get('/:number?/:detail?', loadHardwares, loadDetails, async function(req, res, next) {
	if(req.params.detail === 'delete') return next(); // Исключаем путь к удалению
	if (req.data.length === 1) {
		/* Если у нас в ответе находится одно оборудование (к примеру запрос по инв. номеру)
		* то генерируем страницу HTML вставив следующие параметры:
		* req.data - Оборудование, req.details - Запчасти, req.session.auth - сессия пользователя
		*/
		return res.render('subviews/status', {
			rows: req.data,
			details: req.details,
			auth: req.session.auth
		});
	}
	if (req.data.length === 0) {
		/* Если у нас нет еще оборудование в БД то выводим пустую начальную страницу */
		return res.render('index', {rows: req.data, auth: req.session.auth});
	}
	if (req.data.length > 1) {
		/* Если у нас более одного оборудование формируем начальную страницу со всем оборудование из БД
		* req.data - Оборудование, req.session.auth - сессия пользователя
		*/
		return res.render('index', {rows: req.data, auth: req.session.auth});
	}
	else {
	    if(req.params.number === 'details') {
	    	/* GET http://localhost:3000/details */
            if(!req.session.auth) return res.status(401).end(); // Если не авторизован то
            const details = await Detail.find({}); // Запрашиваем все оборудование
			/*
			* Генерируем страницу со всеми запчастями из БД
			* details - запчасти, req.session.auth - сессия пользователя
			*/
            return res.render('subviews/details', {rows: [ {number: 'details'} ],
                details: details, auth: req.session.auth});
        }
	    /*
	    * Если оборудование по инв. номеру не найден то показываем пользователю 404 Not Found*/
		let er = new Error('Hardware not found');
		er.status = 404;
		return next(er);
	}
});

/*
* Пример запроса: POST http://localhost:3000/auth
* Тело: {key: "пароль который ввел пользователь"}
* В ответ получает либо 200(ОК) либо 401 (Доступ запрещен)
*/
router.post('/auth', async function(req, res, next) {
	req.session.auth = req.body.key === global.admin_secret;
	return res.status(req.session.auth ? 200 : 401).end();
});

/*
* Пример запроса: POST http://localhost:3000/
* Тело: {
* 	number: "инв. номер",
* 	hardware: "Наименование оборудование",
* 	producer: "производитель",
* 	model: "модель",
* 	location: "расположение",
* 	replaced: "когда заменен",
* }
* В ответ получает либо 401 (Доступ запрещен)
* либо происходит переадресация пользователя
* на только что созданное оборудование
*/
router.post('/', async function(req, res, next) {
	if(!req.session.auth) return res.status(401).end();
	let hardware = await Hardware.create(req.body); // Создаем новое оборудование
	return res.redirect(req.baseUrl + '/' + hardware.number)
});

/*
* Пример запроса: POST http://localhost:3000/number/status
* number - обязательные параметр (нету знака ? после параметра)
* обработчики: Запрос оборудование -> запрос запчастей.
* Тело: {
* 	name: "наименование",
* 	producer: "производитель",
* 	specifications: "характиристики",
* 	comments: "комментарии"
* }
* В ответ получает либо 401 (Доступ запрещен)
* либо происходит переадресация пользователя
* на только что редактируемое оборудование.
*/
router.post('/:number/status', loadHardwares, loadDetails, async function(req, res, next) {
	if(!req.session.auth) return res.status(401).end(); // если нет доступа отправляем 401
	const detail = await Detail.create(req.body); // Создаем объект запчасти
	if(req.data[0].deatils === undefined) req.data[0].deatils = []; // Если у оборудование нет еще запчастей
	req.data[0].details.push(mongoose.Types.ObjectId(detail._id)); // Добавление идентификатора запчасти в поле запчастей оборудование
	
	let obj = req.data[0];
	delete obj._id;
	await Hardware.updateOne({_id : req.data[0]._id}, obj); // Обновляем данные в БД

	return res.redirect(req.baseUrl + '/' + req.params.number) // переадресация на карточку оборудование
});

/*
* Пример запроса: POST http://localhost:3000/number
* number - обязательный параметр (нету знака ? после параметра)
* обработчики: Запрос оборудование.
* Тело: {
* 	number: "инв. номер",
* 	hardware: "Наименование оборудование",
* 	producer: "производитель",
* 	model: "модель",
* 	location: "расположение",
* 	replaced: "когда заменен",
* }
* В ответ получает либо 401 (Доступ запрещен)
* либо происходит переадресация пользователя
* на только что редактируемое оборудование.
*/
router.post('/:number', loadHardwares, async function(req, res, next) { //
	if(!req.session.auth) return res.status(401).end(); // Если пользователь не авторизован

	let data = {};
	Object.keys(req.body).forEach(function(key) { // Убираем все пустые поля.
		if(req.body[key] !== '') data[key] = req.body[key]
	});

	if(Object.keys(data).length !== 0) { // Если не все поля пустые (из объекта тело)
		await Hardware.updateOne({_id : req.data[0]._id}, data); // обновляем инфу об оборудование.
	}

	return res.redirect(req.baseUrl + '/' + req.params.number) // переадресация на карточку оборудование
});

/*
* Пример запроса: POST http://localhost:3000/number/detail
* number - обязательный параметр (нету знака ? после параметра)
* detail - обязательный параметр (нету знака ? после параметра)
* обработчики: Запрос оборудование -> запрос запчастей.
* Тело: {
* 	name: "наименование",
* 	producer: "производитель",
* 	specifications: "характиристики",
* 	comments: "комментарии"
* }
* В ответ получает либо 401 (Доступ запрещен)
* либо происходит переадресация пользователя
* на только что редактируемое оборудование.
*/

router.post('/:number/:detail', loadHardwares, loadDetails, async function(req, res, next) {
	if(!req.session.auth) return res.status(401).end(); // Если пользователь неавторизованный
	let data = {};
	Object.keys(req.body).forEach(function(key) { // Фильтруем пустые поля
		if(req.body[key] !== '') data[key] = req.body[key]
	});
	if(Object.keys(data).length !== 0) { // Если не все поля тела req.body пусты
		await Detail.updateOne({_id : req.params.detail}, data); // обновим инфу детали.
	}
	return res.redirect(req.baseUrl + '/' + req.params.number)  // переадресация на карточку оборудование
});

/*
* Пример запроса: GET http://localhost:3000/number/id/delete
* number - обязательный параметр (нету знака ? после параметра)
* id - обязательный параметр (нету знака ? после параметра)
* обработчики: Запрос оборудование -> запрос запчастей.
* В ответ получает либо 401 (Доступ запрещен)
* либо происходит удаление запчасти.
*/

router.get('/:number/:id/delete', loadHardwares, loadDetails, async function(req, res, next) {
	if(!req.session.auth) return res.status(401).end();
	if(req.params.number === undefined) obj = {}; // Если нет номера
	if(req.params.id === undefined) obj = {}; // Если нет идентификатор
	else obj = {'_id': req.params.id};
	
	await Detail.deleteOne(obj); // Удаление детали
	req.data[0].details.remove(req.params.id); // убираем с массива запчастей оборудование
	
	obj = req.data[0];
	delete obj._id;
	await Hardware.updateOne({_id : req.data[0]._id}, obj); // обновим инфу об оборудование

	res.redirect(req.baseUrl + '/' + req.params.number) // переадресация на карточку оборудование
});

/*
* Пример запроса: GET http://localhost:3000/number/delete
* number - обязательный параметр (нету знака ? после параметра)
* обработчики: Запрос оборудование -> запрос запчастей.
* В ответ получает либо 401 (Доступ запрещен)
* В ответ получает либо 500 (Ошибка сервера)
* либо происходит удаление оборужлвание вместе с его запчасти.
*/
router.get('/:number/delete', loadHardwares, loadDetails, async function(req, res, next) {
	if(!req.session.auth) return res.status(401).end(); // Если не авторизован
	if(req.params.number === undefined) return res.status(500).end(); // Если не задан инв. номер

	await Detail.deleteMany({'_id': {'$in': req.data[0].details }}); // Удаляем все запчасти
	await Hardware.deleteOne({'_id': req.data[0]._id}); // удаляем оборудование
	res.redirect(req.baseUrl + '/') // переадресуем пользователя на главную страницу.
});

module.exports = router;
