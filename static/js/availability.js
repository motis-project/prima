var cell_map = {};
var tours = {};

const color_available = "#fcf3cf";
const color_booked = "#e67e22";

var mouse_down_id = "";
var mouse_up_id = "";

var current_dt = Date.now();

function clear() {
    cell_map = {};
    rows = new Array('tbody-1', 'tbody-2', 'tbody-3');
    rows.forEach(tb_id => {
        let tbody = document.getElementById(tb_id);
        tbody.querySelectorAll('tr').forEach(row => {
            row.querySelectorAll('td').forEach(cell => {
                if (cell.childNodes.length == 3) {
                    cell.children[0].querySelectorAll('tr').forEach(r => {
                        r.querySelectorAll('td').forEach(c => {
                            c.style.backgroundColor = "white";
                        });
                    });
                }
            });
        });
    });
}

function init(reload) {
    if (document.getElementById('availability-table') == null) {
        return;  // no vehicles
    }
    clear();
    rows = new Array('tbody-1', 'tbody-2', 'tbody-3');
    rows.forEach(tb_id => {
        let tbody = document.getElementById(tb_id);
        tbody.querySelectorAll('tr').forEach(row => {
            row.querySelectorAll('td').forEach(cell => {
                if (cell.childNodes.length == 3) {
                    cell.children[0].querySelectorAll('tr').forEach(r => {
                        r.querySelectorAll('td').forEach(c => {
                            if (reload) {
                                c.addEventListener('mousedown', () => {
                                    mouse_down_id = c.id;
                                    if (cell_map[c.id].get('tour') == 0) {
                                        c.style.backgroundColor = 'lightgrey';
                                        c.style.color = 'lightgrey';
                                    }
                                });
                                c.addEventListener('mouseup', () => {
                                    mouse_up_id = c.id;
                                    toggle_available(c.id);
                                    mouse_up_id = '';
                                    mouse_down_id = '';
                                });
                                c.addEventListener('mouseover', () => {
                                    let md_v_id = mouse_down_id.split('-')[1];
                                    let v_id = c.id.split('-')[1];
                                    if (mouse_down_id != '' && md_v_id == v_id && cell_map[c.id].get('tour') == 0) {
                                        c.style.backgroundColor = 'lightgrey';
                                        c.style.color = 'lightgrey';
                                    }
                                });
                            }
                            cell_map[c.id] = new Map([
                                ['state', 0],
                                ['tour', 0],
                            ]);
                            c.style.color = 'white';
                        });
                    });
                }
            });
        });
    });
    get_availability();
    get_tours();
}

function get_cell_id(vehicle_id, date) {
    h = date.getHours().toString();
    m = date.getMinutes().toString();

    if (h.length < 2) h = '0' + h;
    if (m.length < 2) m = '0' + m;

    today_dom = new Date(current_dt).getDate();
    date_dom = new Date(date).getDate();

    if (date_dom == today_dom - 1 && date.getHours() >= 23) prefix = 'y';
    else if (date_dom == today_dom + 1 && date.getHours() < 1) { prefix = 't'; }
    else if (date_dom == today_dom) prefix = 'c';
    else return null; // datetime out of display range

    id = prefix + '-' + vehicle_id + '-' + h + '-' + m;
    return id;
}

function check_availability(vehicle_id, tour_id) {
    let t_start = tours[tour_id]['departure'];
    let t_end = tours[tour_id]['arrival'];
    let d_start = new Date(Date.parse(t_start.replace(' ', 'T')));
    let d_end = new Date(Date.parse(t_end.replace(' ', 'T')));
    let d_next = d_start;

    while (d_next <= d_end) {
        let c_id = get_cell_id(vehicle_id, d_next);
        d_next = new Date(d_next.getTime() + 15 * 60000);
        if (c_id == null) continue;
        if (cell_map[c_id].get('state') != 1) {
            alert('Verschiebung nicht möglich.');
            return false;
        }
    }

    return true;
}

function mark_cells(vehicle_id, t_start, t_end, target_state, tour_id, move) {
    let d_start = new Date(Date.parse(t_start.replace(' ', 'T')));
    let d_end = new Date(Date.parse(t_end.replace(' ', 'T')));
    let d_next = d_start;


    while (d_next <= d_end) {
        let c_id = get_cell_id(vehicle_id, d_next);
        d_next = new Date(d_next.getTime() + 15 * 60000);
        if (c_id == null) continue;

        if (cell_map[c_id].get('state') == 2 && !move) continue;

        if (target_state == 1) {
            cell = document.getElementById(c_id);
            cell.style.backgroundColor = color_available;
            cell.style.color = color_available;
            cell_map[c_id].set('tour', 0);
        } else if (target_state == 2) {
            cell = document.getElementById(c_id);
            cell.style.backgroundColor = color_booked;
            cell.style.color = color_booked;
            cell_map[c_id].set('tour', tour_id);
        } else if (target_state == 0) {
            cell = document.getElementById(c_id);
            cell.style.backgroundColor = 'white';
            cell.style.color = 'white';
            cell_map[c_id].set('tour', 0);
        }
        cell_map[c_id].set('state', target_state);
    }
}

function get_datetime_str(date, h, m) {
    h_str = h.toString();
    m_str = m.toString();

    if (h_str.length < 2) h_str = '0' + h_str;
    if (m_str.length < 2) m_str = '0' + m_str;

    let time_str = h_str + ':' + m_str + ':00';
    let day = date.getDate().toString();
    let month = (date.getMonth() + 1).toString();
    let year = date.getFullYear().toString();

    if (day.length < 2) day = '0' + day;
    if (month.length < 2) month = '0' + month;

    dt_str = year + '-' + month + '-' + day + ' ' + time_str;
    return dt_str;
}

function get_cell_info(cell_id) {
    let tokens = cell_id.split('-');
    let vehicle_id = tokens[1];
    let h = tokens[2];
    let m = tokens[3];

    let start_date = new Date(current_dt);

    if (tokens[0] == 'y') {
        start_date.setDate(new Date(current_dt).getDate() - 1);
        start_date.setHours(h);
        start_date.setMinutes(m);
    }

    if (tokens[0] == 't') {
        start_date.setDate(start_date.getDate() + 1);
        start_date.setHours(h);
        start_date.setMinutes(m);
    }

    dt_str = get_datetime_str(start_date, h, m);
    return [vehicle_id, dt_str];
}

function toggle_available(cell_id) {
    let cell_info_start = get_cell_info(mouse_down_id);
    let cell_info_end = get_cell_info(mouse_up_id);
    let vehicle_id_1 = cell_info_start[0];
    let vehicle_id_2 = cell_info_end[0];
    let date_time_start = cell_info_start[1];
    let date_time_end = cell_info_end[1];
    let state = cell_map[cell_id].get('state');

    if (mouse_down_id == mouse_up_id && state == 2) {
        tour_id = cell_map[cell_id].get('tour');
        window.open('http://localhost:3030/tour_details?id=' + tour_id, '_blank').focus();
    }

    if (vehicle_id_1 == vehicle_id_2) {
        // mouse-up and mouse-down in same row
        dt_start = new Date(date_time_start);
        dt_end = new Date(date_time_end);
        if (dt_start > dt_end) {
            let tmp = date_time_start;
            date_time_start = date_time_end;
            date_time_end = tmp;
        }

        if (state == 0) {
            mark_cells(vehicle_id_1, date_time_start, date_time_end, 1, 0, false);
            set_availability(parseInt(vehicle_id_1), true, date_time_start, date_time_end);
        } else if (state == 1) {
            mark_cells(vehicle_id_1, date_time_start, date_time_end, 0, 0, false);
            set_availability(parseInt(vehicle_id_1), false, date_time_start, date_time_end);
        }
    } else {
        // mouse-up and mouse-down in different rows
        switch_vehicle_for_tour(cell_map[mouse_down_id].get('tour'), mouse_down_id.split('-')[1], mouse_up_id.split('-')[1]);
    }

    mouse_down_id = "";
    mouse_up_id = "";
}

function get_availability() {
    let dt = new Date(current_dt);
    let day = ("0" + dt.getDate()).slice(-2);
    let month = ("0" + (dt.getMonth() + 1)).slice(-2);
    let date = dt.getFullYear() + "-" + month + "-" + day;
    fetch("http://localhost:3030/vehicle_availability?id=6&date=" + date)
        .then(res =>
            res.json()).then(availability_lst => {
                availability_lst.forEach(e => {
                    mark_cells(e['id'], e['availability_start'], e['availability_end'], 1, 0, false);
                });
            })
}

function set_availability(vehicle_id, create, t_start, t_end) {
    data = { 'id': vehicle_id, 'create': create, 'availability_start': t_start, 'availability_end': t_end };
    fetch("http://localhost:3030/availability", {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),

    });
}

function get_tours() {
    today = new Date(current_dt);
    let time_frame_start = get_datetime_str(today, 0, 0).replace(' ', 'T');
    let time_frame_end = get_datetime_str(today, 23, 59).replace(' ', 'T');
    fetch("http://localhost:3030/vehicle_tours?vehicle_id=1"
        + '&time_frame_start=' + time_frame_start
        + '&time_frame_end=' + time_frame_end)
        .then(res =>
            res.json()).then(data => {
                data.forEach(e => {
                    start_rounded = round_to_quarter(e['departure'], true);
                    end_rounded = round_to_quarter(e['arrival'], false);
                    d_start_str = get_datetime_str(start_rounded, start_rounded.getHours(), start_rounded.getMinutes());
                    d_end_str = get_datetime_str(end_rounded, end_rounded.getHours(), end_rounded.getMinutes());
                    mark_cells(e['vehicle_id'], d_start_str, d_end_str, 2, e['id'], false);
                    tours[e['id']] = e;
                });
            });
}

function round_to_quarter(time, is_departure) {
    let dt = new Date(Date.parse(time.replace(' ', 'T')));
    let minutes = dt.getMinutes();
    if (minutes < 15) {
        if (is_departure) {
            dt.setMinutes(0);
        } else dt.setMinutes(15);
    }
    if (minutes > 15 && minutes < 30) {
        if (is_departure) {
            dt.setMinutes(15);
        } else dt.setMinutes(30);
    }
    if (minutes > 30 && minutes < 45) {
        if (is_departure) {
            dt.setMinutes(30);
        } else dt.setMinutes(45);
    }
    if (minutes > 45) {
        if (is_departure) {
            dt.setMinutes(45);
        } else {
            // set to next full hour
            dt = new Date(dt.getTime() + 60 * 60000);
            dt.setMinutes(0);
        }
    }

    return dt;
}

function switch_vehicle_for_tour(tour_id, v_id_src, v_id_dst) {
    let tour = tours[tour_id];
    let move_possible = check_availability(v_id_dst, tour_id);
    if (move_possible) {
        mark_cells(v_id_dst, tour.departure, tour.arrival, 2, tour_id, false);
        mark_cells(v_id_src, tour.departure, tour.arrival, 0, tour_id, true);
    }
}

function change_date() {
    current_dt = new Date(dateInput.value);
    init(false);
}

init(true);

const dateInput = document.getElementById('dateInput');
const prevDayBtn = document.getElementById('prevDay');
const nextDayBtn = document.getElementById('nextDay');

const dt = new Date(current_dt);
const day = ("0" + dt.getDate()).slice(-2);
const month = ("0" + (dt.getMonth() + 1)).slice(-2);
const date = dt.getFullYear() + "-" + month + "-" + day;
dateInput.value = date;

// Function to navigate to the previous day
prevDayBtn.addEventListener('click', () => {
    const currentDate = new Date(dateInput.value);
    currentDate.setDate(currentDate.getDate() - 1);
    dateInput.value = currentDate.toISOString().slice(0, 10);
    current_dt = currentDate;
    init(false);
});

// Function to navigate to the next day
nextDayBtn.addEventListener('click', () => {
    const currentDate = new Date(dateInput.value);
    currentDate.setDate(currentDate.getDate() + 1);
    dateInput.value = currentDate.toISOString().slice(0, 10);
    current_dt = currentDate;
    init(false);
});