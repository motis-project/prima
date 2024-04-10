async function test_GET() {
  const response = await fetch("http://localhost:3030/static/test.json");
  const test_obj = await response.json();
  console.log(test_obj);
}

// Example POST method implementation:
async function postData(url = "", data = {}) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: "POST", // *GET, POST, PUT, DELETE, etc.
    mode: "same-origin", // no-cors, *cors, same-origin
    //   cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    //   credentials: "same-origin", // include, *same-origin, omit
    headers: {
      "Content-Type": "application/json",
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    //   redirect: "follow", // manual, *follow, error
    //   referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data), // body data type must match "Content-Type" header
  });
  return response.json(); // parses JSON response into native JavaScript objects
}

async function logout_user() {
  console.log('logout');
  let username = "julia";
  postData("http://localhost:3030/delete", { id: 2, username: username, password: "" }).then((data) => {
    console.log(data);
  });
}

function toggle_select(id) {
  sel = document.getElementById("sel-" + id);
  if (sel.value === "none") {
    sel.style = "background-color: lightcoral;";
  } else {
    sel.style = "background-color: lightgreen;";
  }
}

function show_route(tour_id) {
  console.log(tour_id);
}

function add_vehicle() {
  console.log('clicked');
}
