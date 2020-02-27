/* global prayer */

/**
 * get and display a random hadith from server
 * It will be shwon every 5 min, except in prayer moment
 */
var randomHadith = {
    init: function () {
        if (prayer.confData.randomHadithEnabled) {
            setInterval(function () {
                randomHadith.get();
                setTimeout(function () {
                    randomHadith.hide();
                }, prayer.oneSecond * 90);

            }, 4 * prayer.oneMinute);
        }
    },
    /**
     * check if hadith displaying is allowed, 2 conditions
     * 1- not prayer moment
     * 2- not disabling hadith moment
     * @returns {boolean}
     */
    isAllowed: function () {
        if (prayer.isPrayingMoment()) {
            return false;
        }

        if (prayer.isJumuaMoment()) {
            return false;
        }

        if (/^\d\-\d$/.test(prayer.confData.randomHadithIntervalDisabling)) {
            var prayers = prayer.confData.randomHadithIntervalDisabling.split("-");
            var prayer1 = prayer.getTimeByIndex(parseInt(prayers[0]));
            var prayer2 = prayer.getTimeByIndex(parseInt(prayers[1]));

            var prayer1DateTime = prayer.getCurrentDateForPrayerTime(prayer1);
            var prayer2DateTime = prayer.getCurrentDateForPrayerTime(prayer2);
            var date = new Date();
            if (date > prayer1DateTime && date < prayer2DateTime) {
                return false;
            }
        }

        return true;
    },
    get: function () {
        // start hadith after 5 seconds to bypass a display bug
        setTimeout(function () {
            if (!randomHadith.isAllowed()) {
                return;
            }

            if ($(".main").is(":visible") && !messageInfoSlider.messageInfoIsShowing) {
                var $randomHadithEl = $(".random-hadith");
                $.ajax({
                    url: $randomHadithEl.data("remote"),
                    headers: {'Api-Access-Token': $randomHadithEl.data("apiAccessToken")},
                    success: function (resp) {
                        if (resp.text !== "") {
                            $(".random-hadith .text div").text(resp.text);
                            randomHadith.show(randomHadith.setFontSize);
                        }
                    },
                    error: function () {
                        var hadith = $(".random-hadith .text div").text();
                        if (hadith != "") {
                            randomHadith.show();
                        }
                    }
                });
            }
        }, 5000);
    },
    show: function (callback) {
        prayer.nextPrayerCountdown();
        $(".top-content").fadeOut(1000, function () {
            $("footer").hide();
            $(".random-hadith").fadeIn(300);
            if (typeof callback !== 'undefined') {
                callback();
            }
        });
    },
    hide: function () {
        $(".random-hadith").fadeOut(1000, function () {
            $("footer").show();
            $(".top-content").fadeIn(300);
        });
    },
    setFontSize: function () {
        var $textContainer = $('.random-hadith .text');
        var $textContainerDiv = $('.random-hadith .text div');
        var defaultSize = 10;
        $textContainerDiv.css('font-size', defaultSize + 'vh');
        while ($textContainerDiv.height() > $textContainer.height() - 30) {
            defaultSize = defaultSize - 0.2;
            $textContainerDiv.css('font-size', (defaultSize) + 'vh');
        }
    }
};
