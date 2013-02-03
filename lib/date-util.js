function datetime(date) {
    date = date || new Date();
    if (typeof date === "string") {
        try {
            date = new Date(date);
        } catch (e) {
            return date;
        }
    }
    return date.toISOString().split('T')[0];
}
exports.datetime = datetime;

function daysBefore(days, from) {
    from = from || new Date();
    return datetime(new Date(from - (86400 * 1000 * days)));
}
exports.daysBefore = daysBefore;

function today() {
    return datetime(new Date());
}
exports.today = today;

function yesterday() {
    return datetime(daysBefore(1));
}
exports.yesterday = yesterday;
