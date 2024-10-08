// import mani from './mani.mjs';
// import metax from './metax.mjs';

// $(document).ready(async () => {
//     //Միացում Metax համակարգին
//     const host = window.location.hostname;
//     const port = window.location.port;
//     let secure = false;
//     if(window.location.protocol == "https:") { 
//             secure = true;
//     };
//     await metax.connect(host, port, false, secure);
//     await mani.connect(metax);
//     const data = await metax.get('ca520869-d839-45ae-8288-bc5b0aa22688-2efa9bf5-e4c3-45a9-80ad-890c920ca121');
//     console.log(data);
// });

const global_uuid = '7c05ed22-44c4-4278-9cc6-f294a4c4ccbc-9717155b-3bc9-444b-a568-de9940a87bd0';
$("#login").on("click", async () => {
    var username = $("input[name='username']").val();
    var password = $("input[name='password']").val();
    if (username == "" || password == "") {
        $('.err_message').removeClass("success")
        $('.err_message').addClass("error")
        $('.err_message').html("Please fill all fields.");
        return;
    }
    // TODO
    const data = {
        username: username,
        password: password
    };
    try {
        const response = await fetch('/login', {
            method: 'POST', // Use POST method
            headers: {
                'Content-Type': 'application/json', // Specify JSON content type
            },
            body: JSON.stringify(data) // Convert data object to JSON string
        });
        const result = await response.json(); // Parse the JSON response
        if (result.success) {
            $('.err_message').removeClass("error")
            $('.err_message').addClass("success")
            $('.err_message').html(result.success);
            window.location.href = "/"
        }
        if (result.error) {
            $('.err_message').removeClass("success")
            $('.err_message').addClass("error")
            $('.err_message').html(result.error);
        }
    } catch (error) {
        return {'error' : error};
    }
});


$("#register").on("click", async () => {
    const username = $("input[id='reg_username']").val();
    const email = $("input[id='reg_email']").val();
    const password = $("input[id='reg_password']").val();
    const repeat_password = $("input[id='repeat_password']").val();
    const date_registered = () => new Date().toLocaleDateString('en-US');
    $("#register").attr("disabled", "")
    if (username == "" || password == "" || email == "" || repeat_password == "") {
        $('.err_message').removeClass("success")
        $('.err_message').addClass("error")
        $('.err_message').html("Լրացրեք բոլոր դաշտերը");
        $("#register").removeAttr("disabled", "false")
        return;
    }
    if (repeat_password !== password) {
        $('.err_message').removeClass("success")
        $('.err_message').addClass("error")
        $('.err_message').html("Մուտքագրուած գաղտնաբառերը չեն համընկնում");
        $("#register").removeAttr("disabled", "false")
        return; 
    }
    // TODO
    const data = {
        username: username,
        password: password,
        email: email
    };
    try {
        const response = await fetch('/register', {
            method: 'POST', // Use POST method
            headers: {
                'Content-Type': 'application/json', // Specify JSON content type
            },
            body: JSON.stringify(data) // Convert data object to JSON string
        });
        const result = await response.json();
        if (result.success) {
            $('.err_message').removeClass("error")
            $('.err_message').addClass("success")
            $('.err_message').html(result.success);
            $("#register_form").hide(200)
            $("#login_form").show(200)
            $("#register").removeAttr("disabled", "false")
        }
        if (result.error) {
            $('.err_message').removeClass("success")
            $('.err_message').addClass("error")
            $('.err_message').html(result.error);
        }
    } catch (error) {
        return {'error' : error};
    }
});

$("#switch_to_login").on("click", ()=> {
    $("#register_form").hide(200)
    $("#login_form").show(200)
})

$("#switch_to_register").on("click", ()=> {
    $("#register_form").show(200)
    $("#login_form").hide(200)
})

$('.create-new-post').on("click", function(e) {
    e.preventDefault();

    $("#newPostPopup").show(200)
    $("#newPostPopup").css("display", "flex");
    $("#newPostPopup").css("z-index", "999");
});

// Hide popup when 'Close' is clicked
$(".close-btn").on("click", function() {
    $("#newPostPopup").hide(100)
});

// Hide popup when clicking outside the form
$(window).on("click", function(e) {
    if ($(e.target).is("#newPostPopup")) {
        $("#newPostPopup").hide(100)
    }
});

// Preview attached media (photos/videos)
$("#postMedia").on("change", function() {
    $("#mediaPreview").empty();  // Clear the preview area

    const files = Array.from(this.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const mediaElement = $(file.type.startsWith("image/") ? "<img>" : "<video controls>");
            mediaElement.attr("src", e.target.result);
            $("#mediaPreview").append(mediaElement);
        }
        reader.readAsDataURL(file);
    });
});

$("#create-post").on("click", ()=> {
    var data = new FormData();
    var title = $('#postTitle').val();
    var content = $('#postContent').val();
    var media = $('#postMedia')[0].files;
    var access = $('#access').val()
    var hashtags = [];
    $('#hashtagList li').each(function() {
        var value = $(this).attr('data-hashtag');
        data.append('hashtags[]', value);
    });
    data.append('title', title);
    data.append('hashtags[]', hashtags);
    data.append('content', content);
    data.append('access', access);
    // Add all selected media files to the FormData object
    $.each(media, function(i, file) {
        data.append('media', file);
    });
    fetch('/create-publication', {
        method: 'POST',
        body: data
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to create post');
        }
        return response.json();
    })
    .then(async (data) => {
        console.log('Post created successfully:', data);
        alert('Post created successfully!');
        // Clear the form and close the popup (optional)
        $('#createPostForm')[0].reset();
        $('#newPostPopup').hide();
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to create post.');
    });
})

function fetchFromUUID(uuid, what) {
    return fetch(`/get?id=${uuid}&what=${what}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            return data.uuid;
        })
        .catch(error => {
            console.error("Error fetching photo:", error);
            throw error;
        });
}

function sendFriendRequest(to) {
    return fetch(`/send_friend_request?to=${to}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            $("body > header > div.search > input[type='search']").keyup();
        })
        .catch(error => {
            console.error("Error fetching photo:", error);
            throw error;
        });
}

function cancelFriendRequest(to) {
    return fetch(`/cancel_friend_request?to=${to}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            $("body > header > div.search > input[type='search']").keyup();
        })
        .catch(error => {
            console.error("Error fetching photo:", error);
            throw error;
        });
}

$("body > header > div.search > input[type='search']").on("keyup", function () {
    let query = $(this).val();
    if (query.length == 0) {
        window.location.reload();
    }
    $.ajax({
        url: `/search?query=${query}`,
        method: 'GET',
        success: function(response) {
            $("#feed").html(response);
        },
        error: function() {
            $("#feed").html("<p>Error fetching results.</p>");
        }
    });
});
