function playMessageAnimation(message) {

    setTimeout(() => {
        message.classList.remove("new-message");
    }, 350);

    setTimeout(() => {

        message.classList.add("fade-out");

        setTimeout(() => {
            message.remove();
        }, 400);

    }, RelaySettings.fadeTime * 1000);

}