/**
 * get and display a random hadith from server
 * It will be shwon every 5 min, except in prayer moment
 */
var randomHadith = {
    isRunning: false,
    init: function () {
        if (prayer.confData.randomHadithEnabled) {
            setInterval(function () {
                if (!randomHadith.isRunning && !prayer.isPrayingMoment()) {
                    randomHadith.get();
                    setTimeout(function () {
                        randomHadith.hide();
                    }, 2 * prayer.oneMinute);
                }
            }, 5 * prayer.oneMinute);
        }
    },
    get: function () {
        $.ajax({
            type: "JSON",
            url: "../get-random-hadith/" + lang,
            success: function (resp) {
                if (resp.text !== "") {
                    $(".random-hadith").removeClass("random-hadith-fr");
                    $(".random-hadith .text").text(resp.text);
                    randomHadith.setFontSize(resp.text, resp.lang);
                    if (resp.lang === "fr") {
                        $(".random-hadith").addClass("random-hadith-fr");
                    }
                    randomHadith.show();
                }
            },
            error: function () {
                randomHadith.hide();
            }
        });
    },
    show: function () {
        randomHadith.isRunning = true;
        prayer.nextPrayerCountdown();
        $(".desktop .prayer-content").addClass("to-bottom-times");
        $(".desktop .top-content").css("height", "67%");
        $(".desktop .footer").hide();
        $(".desktop .header").hide();
        $(".desktop .top-content .content").fadeOut(1000, function () {
            $(".time-top").fadeIn(1000);
            $(".random-hadith").fadeIn(1000);
        });
    },
    hide: function () {
        randomHadith.isRunning = false;
        $(".random-hadith").fadeOut(1000, function () {
            $(".desktop .prayer-content").removeClass("to-bottom-times");
            $(".desktop .top-content").css("height", "40%");
            $(".desktop .footer").show();
            $(".desktop .header").show();
            $(".desktop .top-content .content").fadeIn(1000);
        });
    },
    setFontSize: function (text, lang) {
        var size;
        if (text.length < 100) {
            size = 130;
        }
        if (text.length >= 100 && text.length < 150) {
            size = 120;
        }
        if (text.length >= 150 && text.length < 200) {
            size = 100;
        }
        if (text.length >= 200 && text.length < 250) {
            size = 95;
        }
        if (text.length >= 250 && text.length < 300) {
            size = 85
        }
        if (text.length >= 300 && text.length < 350) {
            size = 75;
        }
        if (text.length >= 350) {
            size = 60;
        }
        if (lang === "fr")
        {
            size -= 15;
        }

        $(".random-hadith").css("font-size", size + "px");
    }
};
