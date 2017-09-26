/* global dateTime */
/* global douaaSlider */
/* global messageInfoSlider */

/**
 * Class handling prayers 
 * @author ibrahim.zehhaf@gmail.com
 * @type {object}
 */

var prayer = {
    /**
     * time to wait before hilight next prayer time  (in minutes)
     * @type Number
     */
    nextPrayerHilightWait: 5,
    /**
     * prayer times
     * @type Array
     */
    times: [],
    /**
     * One minute in milliseconds
     * @type Integer
     */
    oneMinute: 60000,
    /**
     * One second in milliseconds
     * @type Integer
     */
    oneSecond: 1000,
    /**
     * Conf from conf.json
     * @type Json
     */
    confData: confData,
    /**
     * in milliseconds
     * @type Number 
     */
    adhanFlashingTime: 90000,
    /**
     * init the app
     */
    init: function () {
        this.loadData();
        this.setBackgroundColor();
        this.setTime();
        this.setDate();
        this.setTimes();
        this.setWaitings();
        this.initNextTimeHilight();
        this.initAdhanFlash();
        this.initIqamaFlash();
        this.initCronHandlingTimes();
        this.jumuaDhikrReminder.init();
        this.setCustomTime();
        this.initUpdateConfData();
        this.initEvents();
        this.translateToArabic();
        this.hideSpinner();
        randomHadith.init();
        douaaSlider.init();
        messageInfoSlider.initCronMessageInfo();
    },
    /**
     * load all data
     */
    setBackgroundColor: function () {
        $("body").css("backgroundColor", prayer.confData.backgroundColor);
    },
    /**
     * load all data
     */
    loadData: function () {
        this.loadTimes();

        // if current time > ichaa time + 5 minutes we load tomorrow times
        var date = new Date();
        if (date.getHours() !== 0) {
            var ichaaDateTime = this.getCurrentDateForPrayerTime(this.getIchaTime());
            if (ichaaDateTime.getHours() !== 0) {
                ichaaDateTime.setMinutes(ichaaDateTime.getMinutes() + this.nextPrayerHilightWait);
                if (date > ichaaDateTime) {
                    this.loadTimes(true);
                }
            }
        }
    },
    /**
     * 
     */
    initUpdateConfData: function () {
        setInterval(function () {
            $.ajax({
                url: "has-been-updated/" + prayer.confData.lastUpdatedDate,
                success: function (resp) {
                    if (resp.hasBeenUpdated === true) {
                        location.reload();
                    }
                }
            });
        }, prayer.oneSecond * 30);
    },
    /**
     * load prayer times
     * if calculChoice = csv we load from csv file
     * else we load from PrayTimes() function
     * @param {boolean} tomorrow if true we load tomorrow time, otherxise we load today times
     */
    loadTimes: function (tomorrow) {
        if (this.confData.calculChoice === "calendar") {
            this.loadTimesFromCalendar(tomorrow);
        } else if (this.confData.calculChoice === "api") {
            this.loadTimesFromApi(tomorrow);
        }
    },
    /**
     * @param {boolean} tomorrow 
     * @returns {Array}
     */
    loadTimesFromCalendar: function (tomorrow) {

        var month = dateTime.getCurrentMonth();
        var day = dateTime.getCurrentDay();
        if (typeof tomorrow === 'boolean' && tomorrow === true) {
            month = dateTime.getTomorrowMonth();
            day = dateTime.getTomorrowDay();
        }
        this.times = prayer.confData.calendar[month][day];

    },
    /**
     * @param {boolean} tomorrow 
     * Load times from PrayTimes API
     */
    loadTimesFromApi: function (tomorrow) {
        var prayTimes = new PrayTimes(prayer.confData.prayerMethod);
        if (prayer.confData.fajrDegree) {
            prayTimes.adjust({"fajr": parseFloat(prayer.confData.fajrDegree)});
        }
        if (prayer.confData.ichaaDegree) {
            prayTimes.adjust({"isha": parseFloat(prayer.confData.ichaaDegree)});
        }

        // times adjustment
        prayTimes.tune({
            fajr: prayer.confData.prayerTimesAdjustment[0],
            dhuhr: prayer.confData.prayerTimesAdjustment[1],
            asr: prayer.confData.prayerTimesAdjustment[2],
            maghrib: prayer.confData.prayerTimesAdjustment[3],
            isha: prayer.confData.prayerTimesAdjustment[4]
        });

        var date = new Date();
        if (typeof tomorrow === 'boolean' && tomorrow === true) {
            date = dateTime.tomorrow();
        }

        var timezone = prayer.confData.timezone == parseInt(prayer.confData.timezone) ? parseInt(prayer.confData.timezone) : 'auto';
        var dst = prayer.confData.dst == parseInt(prayer.confData.dst) ? parseInt(prayer.confData.dst) : 'auto';
        var pt = prayTimes.getTimes(date, [prayer.confData.latitude, prayer.confData.longitude], timezone, dst);

        this.times = {
            1: pt.fajr,
            2: pt.sunrise,
            3: pt.dhuhr,
            4: pt.asr,
            5: pt.maghrib,
            6: pt.isha
        };
    },
    /**
     * get today prayer times, array of only five prayer times
     * @returns {Array}
     */
    getTimes: function () {
        var times = this.times;
        times = [times[1], times[3], times[4], times[5], times[6]];
        $.each(times, function (i, time) {
            times[i] = prayer.dstConvertTimeForCalendarMode(time);
            if (prayer.confData.prayerTimesFixing[i] && prayer.confData.prayerTimesFixing[i] > times[i]) {
                times[i] = prayer.confData.prayerTimesFixing[i];
            }
        });
        return times;
    },
    getTimeByIndex: function (index) {
        return this.getTimes()[index];
    },
    getWaitingByIndex: function (index) {
        var waiting = this.getWaitingTimes()[index];
        // if waiting fixed to 0 we adjust wating to 3 min for adhan and douaa
        if (waiting === 0)
        {
            waiting = 3;
        }
        return waiting;
    },
    /**
     * get prayer waiting taimes
     * @returns {Array}
     */
    getWaitingTimes: function () {
        var waitings = this.confData.prayersWaitingTimes;
        var ichaDate = this.getCurrentDateForPrayerTime(this.getIchaTime());
        if (this.confData.maximumIchaTimeForNoWaiting != null && this.confData.maximumIchaTimeForNoWaiting.matchTime()) {
            var maximumIchaTimeForNoWaitingDate = this.getCurrentDateForPrayerTime(this.confData.maximumIchaTimeForNoWaiting);
            if (ichaDate.getHours() === 0 || ichaDate >= maximumIchaTimeForNoWaitingDate) {
                waitings[4] = 0;
            }
        }
        return waitings;
    },
    /**
     * handle next prayer countdown
     */
    nextPrayerCountdown: function () {
        var date = new Date();
        $.each(prayer.getTimes(), function (index, time) {
            prayerDateTime = prayer.getCurrentDateForPrayerTime(time);
            if (prayerDateTime.getHours() !== 0 && date < prayerDateTime) {
                $(".next-prayer .countdown").countdown(prayerDateTime, function (event) {
                    $(this).text(event.strftime('%H:%M:%S'));
                });
                return false;
            }
        });
    },
    /**
     * +1|-1 hour for time depending DST
     * @param {String} time
     * @returns {Array}
     */
    dstConvertTimeForCalendarMode: function (time) {
        if (prayer.confData.calculChoice === "calendar" && dateTime.isLastSundayDst()) {
            time = time.split(":");
            var hourPrayerTime = Number(time[0]) + (dateTime.getCurrentMonth() === 2 ? 1 : -1);
            var minutePrayerTime = time[1];
            time = addZero(hourPrayerTime) + ':' + minutePrayerTime;
        }
        return time;
    },
    /**
     * get current date object for given prayer time 
     * @param {String} time
     * @returns {Date}
     */
    getCurrentDateForPrayerTime: function (time) {
        var date = new Date();
        time = time.split(':');
        date.setHours(time[0]);
        date.setMinutes(time[1]);
        date.setSeconds(0);
        return date;
    },
    /**
     * get Ichaa time, if ichaa is <= then 19:50 then return 19:50 
     * @returns {String}
     */
    getIchaTime: function () {
        return this.getTimes()[4];
    },
    /**
     * get chourouk time
     * @returns {String}
     */
    getChouroukTime: function () {
        var chouroukTime = this.times[2];
        if (dateTime.isLastSundayDst()) {
            chouroukTime = prayer.dstConvertTimeForCalendarMode(chouroukTime);
        }
        return  chouroukTime;
    },
    /**
     * Get the imsak time calculated by soustraction of imsakNbMinBeforeSobh from sobh time
     * @returns {String}
     */
    getImsak: function () {
        var sobh = this.getTimeByIndex(0);
        var sobhDateTime = this.getCurrentDateForPrayerTime(sobh);
        var imsakDateTime = sobhDateTime.setMinutes(sobhDateTime.getMinutes() - this.confData.imsakNbMinBeforeSobh);
        var imsakDateTime = new Date(imsakDateTime);
        return addZero(imsakDateTime.getHours()) + ':' + addZero(imsakDateTime.getMinutes());
    },
    /**
     * init the cron that change prayer times by day
     * at midnight we change prayer times for the day
     * we check every minute
     */
    initCronHandlingTimes: function () {
        setInterval(function () {
            var date = new Date();
            if (date.getHours() === 0 && date.getMinutes() === 0) {
                prayer.setDate();
                prayer.loadTimes();
                prayer.setTimes();
                prayer.initNextTimeHilight();
            }

            prayer.setCustomTime();
        }, prayer.oneMinute);
    },
    /**
     * Check every minute if athan time is ok
     * if adhan time is ok we flash time
     * after one minute we stop flashing and show adhan douaa
     */
    adhanIsFlashing: false,
    initAdhanFlash: function () {
        setInterval(function () {
            if (!prayer.adhanIsFlashing) {
                var currentTime = dateTime.getCurrentTime(false);
                $(prayer.getTimes()).each(function (currentPrayerIndex, time) {
                    if (time === dateTime.getCurrentTime()) {
                        var prayerElm = $(".prayer:contains(" + currentTime + ")");
                        if (prayerElm.length) {
                            // if joumouaa time we don't flash adhan
                            if (!prayer.isJoumouaa(currentPrayerIndex)) {
                                prayer.adhanIsFlashing = true;
                                prayer.flashAdhan(currentPrayerIndex);
                            }
                        }
                    }
                });
            }
        }, prayer.oneSecond);
    },
    jumuaDhikrReminder: {
        /**
         * init cron
         */
        init: function () {
            if (prayer.confData.jumuaDhikrReminderEnabled === true) {
                setInterval(function () {
                    var date = new Date();
                    if (date.getDay() === 5) {
                        var currentTime = dateTime.getCurrentTime(false);
                        if (currentTime === prayer.getJoumouaaTime() && prayer.confData.jumuaDhikrReminderEnabled === true) {
                            prayer.jumuaDhikrReminder.show();
                            setTimeout(function () {
                                prayer.jumuaDhikrReminder.hide();
                            }, prayer.confData.jumuaDhikrReminderTimeout * prayer.oneMinute);
                        }
                    }
                }, prayer.oneMinute);
            }
        },
        show: function () {
            $(".desktop .main").fadeOut(1000, function () {
                $(".desktop .jumua-dhikr-reminder").fadeIn(1000);
            });
        },
        hide: function () {
            $(".desktop .main").fadeIn(1000, function () {
                $(".desktop .jumua-dhikr-reminder").fadeOut(1000);
            });
        }
    },
    /**
     * Check every second if iqama time is ok
     * if ok we show iqama flashing for 30 sec
     */
    iqamaIsFlashing: false,
    initIqamaFlash: function () {
        setInterval(function () {
            if (!prayer.iqamaIsFlashing) {
                var currentDateForPrayerTime, diffTimeInMiniute, currentPrayerWaitingTime, date;
                $(prayer.getTimes()).each(function (currentPrayerIndex, time) {
                    date = new Date();
                    currentDateForPrayerTime = prayer.getCurrentDateForPrayerTime(time);

                    if (date.getHours() === 0 && currentDateForPrayerTime.getHours() === 23) {
                        currentDateForPrayerTime.setDate(currentDateForPrayerTime.getDate() - 1);
                    }

                    diffTimeInMiniute = Math.floor((date - currentDateForPrayerTime) / prayer.oneMinute);
                    currentPrayerWaitingTime = prayer.getWaitingByIndex(currentPrayerIndex);
                    if (diffTimeInMiniute === currentPrayerWaitingTime) {
                        prayer.iqamaIsFlashing = true;
                        // iqama flashing
                        prayer.flashIqama(currentPrayerIndex);
                    }
                });
            }
        }, prayer.oneSecond);
    },
    /**
     * Flash adhan for 1 minute
     * @param {Number} currentPrayerIndex
     */
    flashAdhan: function (currentPrayerIndex) {
        if (prayer.confData.azanVoiceEnabled === true) {
            this.playSound("adhan-maquah.mp3");
        } else if (prayer.confData.azanBip === true) {
            this.playSound();
        }
        // iqama countdown
        prayer.iqamaCountdown(currentPrayerIndex);
        // timeout for douaa show
        prayer.douaa.setTimeout(currentPrayerIndex);
        $(".top-content .content").addClass("hidden");

        var adhanFlashInterval = setInterval(function () {
            $(".top-content .adhan-flash").toggleClass("hidden");
            $(".mobile .prayer-content .adhan" + currentPrayerIndex).toggleClass("hidden");
            $(".mobile .prayer-content .prayer" + currentPrayerIndex).toggleClass("hidden");
        }, prayer.oneSecond);
        // timeout for stopping time flashing
        setTimeout(function () {
            prayer.stopAdhanFlashing(adhanFlashInterval, currentPrayerIndex);
        }, prayer.adhanFlashingTime);
    },
    /**
     * flash iqama for 30 sec
     * @param {Number} currentPrayerIndex 
     */
    flashIqama: function (currentPrayerIndex) {
        if (prayer.confData.iqamaBip === true) {
            this.playSound();
        }
        // init next hilight timeout
        prayer.setNextTimeHilight(currentPrayerIndex);
        // init douaa after prayer timeout
        douaaSlider.show(currentPrayerIndex);

        // if joumuaa time we don't flash iqama
        if (!prayer.isJoumouaa(currentPrayerIndex)) {
            $(".main").addClass("hidden");
            var iqamaFlashInterval = setInterval(function () {
                $(".iqama").toggleClass("hidden");
            }, prayer.oneSecond);
            // stop iqama flashing after 45 sec
            setTimeout(function () {
                prayer.stopIqamaFlashing(iqamaFlashInterval);
            }, prayer.confData.iqamaDisplayTime * prayer.oneSecond);
        }
        // reset flag iqamaIsFlashing after one minute
        setTimeout(function () {
            prayer.iqamaIsFlashing = false;
        }, prayer.oneMinute);
    },
    stopAdhanFlashing: function (adhanFlashInterval, currentPrayerIndex) {
        clearInterval(adhanFlashInterval);
        prayer.adhanIsFlashing = false;
        $(".top-content .content").removeClass("hidden");
        $(".top-content .adhan-flash").addClass("hidden");
        $(".mobile .prayer-content .adhan" + currentPrayerIndex).addClass("hidden");
        $(".mobile .prayer-content .prayer" + currentPrayerIndex).removeClass("hidden");
    },
    stopIqamaFlashing: function (iqamaFlashInterval) {
        clearInterval(iqamaFlashInterval);
        $(".main").removeClass("hidden");
        $(".iqama").addClass("hidden");
    },
    /**
     * Play a bip
     */
    playSound: function (file) {
        if (typeof file === "undefined")
        {
            file = "bip.mp3";
        }

        var audio = new Audio('/static/mp3/' + file);
        audio.play();
    },
    /**
     * Set iqama countdonwn
     * @param {Number} currentPrayerIndex
     */
    iqamaCountdown: function (currentPrayerIndex) {
        var time = prayer.getTimeByIndex(currentPrayerIndex);
        var waiting = $(".desktop .wait._" + currentPrayerIndex).text();
        var prayerTimeDate = prayer.getCurrentDateForPrayerTime(time);
        var prayerTimePlusWaiting = prayerTimeDate.setMinutes(prayerTimeDate.getMinutes() + prayer.getWaitingByIndex(currentPrayerIndex));
        var currentElem = $(".wait._" + currentPrayerIndex);
        $(currentElem).countdown(prayerTimePlusWaiting, function (event) {
            $(this).text(event.strftime('%M:%S'));
        }).on('finish.countdown', function () {
            $(currentElem).each(function (i, el) {
                $(el).text(waiting);
            });
        });
    },
    /**
     * search and set the next prayer time hilight
     */
    initNextTimeHilight: function () {
        var date = new Date();
        // sobh is default
        prayer.hilightByIndex(0);
        var times = this.getTimes();
        $.each(times, function (index, time) {
            prayerDateTime = prayer.getCurrentDateForPrayerTime(time);
            // adding 15 minute
            prayerDateTime.setMinutes(prayerDateTime.getMinutes() + prayer.nextPrayerHilightWait);
            if (prayerDateTime.getHours() !== 0 && date > prayerDateTime) {
                index++;
                if (index === 5) {
                    index = 0;
                }
                prayer.hilightByIndex(index);
            }
        });
    },
    /**
     * hilight prayer by index
     * @param {Number} prayerIndex
     */
    hilightByIndex: function (prayerIndex) {
        var time = this.getTimeByIndex(prayerIndex);
        $(".prayer").removeClass("prayer-hilighted");
        $(".prayer-text .text").removeClass("text-hilighted");
        $(".prayer-wait .wait").removeClass("text-hilighted");

        // if joumouaa we hilight joumouaa time
        if (prayer.isJoumouaa(prayerIndex)) {
            $(".joumouaa-id").addClass("prayer-hilighted");
            return;
        }

        $(".prayer-text ._" + prayerIndex).addClass("text-hilighted");
        $(".prayer-wait ._" + prayerIndex).addClass("text-hilighted");
        $(".prayer-content .prayer:contains(" + time + ")").addClass("prayer-hilighted");
    },
    /**
     * 10 minute after current iqama we hilight the next prayer time
     * @param {int} currentTimeIndex 
     */
    setNextTimeHilight: function (currentTimeIndex) {
        nextTimeIndex = currentTimeIndex + 1;
        // if icha is the current prayer
        if (nextTimeIndex === 5) {
            nextTimeIndex = 0;
        }
        setTimeout(function () {
            prayer.hilightByIndex(nextTimeIndex);
            // if ichaa we load tomorrow times
            var date = new Date();
            if (nextTimeIndex === 0 && date.getHours() !== 0) {
                prayer.loadTimes(true);
                prayer.setTimes();
            }
        }, prayer.nextPrayerHilightWait * prayer.oneMinute);
    },
    douaa: {
        showAdhanDouaa: function () {
            $(".desktop .main").fadeOut(1000, function () {
                $(".desktop .adhan").fadeIn(1000);
            });
        },
        hideAdhanDouaa: function () {
            $(".desktop .adhan").fadeOut(1000, function () {
                $(".desktop .main").fadeIn(1000);
            });
        },
        showHadith: function () {
            $(".desktop .main").fadeOut(1000, function () {
                $(".desktop .douaa-between-adhan-iqama").fadeIn(1000);
            });
        },
        hideHadith: function () {
            $(".desktop .douaa-between-adhan-iqama").fadeOut(1000, function () {
                $(".desktop .main").fadeIn(1000);
            });
        },
        /**
         * show douaa 2.5 minutes after adhan flash
         * show douaa for configured time
         * show hadith to remeber importance of douaa between adhan and iqama, 3 minutes after adhan flash
         * @param {Number} currentPrayerIndex
         */
        setTimeout: function (currentPrayerIndex) {
            if (prayer.confData.douaaAfterAdhanEnabled === true) {
                setTimeout(function () {
                    prayer.douaa.showAdhanDouaa();
                    setTimeout(function () {
                        prayer.douaa.hideAdhanDouaa();

                        // show hadith between adhan and iqama
                        if (prayer.getWaitingTimes()[currentPrayerIndex] !== 0) {
                            setTimeout(function () {
                                prayer.douaa.showHadith();
                                setTimeout(function () {
                                    prayer.douaa.hideHadith();
                                }, 30 * prayer.oneSecond);
                            }, 30 * prayer.oneSecond);
                        }

                    }, prayer.confData.adhanDouaaDisplayTime * prayer.oneSecond);
                }, 150 * prayer.oneSecond);
            }
        }
    },
    /**
     * set time every second
     */
    setTime: function () {
        $(".time").text(dateTime.getCurrentTime(true));
        setInterval(function () {
            $(".time, .time-bottom").text(dateTime.getCurrentTime(true));
        }, prayer.oneSecond);
    },
    /**
     * set date
     */
    setDate: function () {
        $(".gregorianDate").text(dateTime.getCurrentDate(lang));
        this.setCurrentHijriDate();
    },
    /**
     * set hijri date from hijriDate.js
     */
    setCurrentHijriDate: function () {
        if (prayer.confData.hijriDateEnabled === true) {
            $(".hijriDate").text(writeIslamicDate(prayer.confData.hijriAdjustment));
        }
    },
    /**
     * get joumouaa time depending dst
     * @returns {String}
     */
    getJoumouaaTime: function () {
        if (this.confData.jumuaAsDuhr === true) {
            // return duhr
            return this.getTimeByIndex(1);
        }
        if (this.confData.joumouaaTime) {
            return this.confData.joumouaaTime;
        }
        return dateTime.isDst() ? "13:15" : "12:15";
    },
    /**
     * if current time is joumouaa
     * @param {int} currentPrayerIndex 
     * @returns {boolean}
     */
    isJoumouaa: function (currentPrayerIndex) {
        var date = new Date();
        return date.getDay() === 5 && currentPrayerIndex === 1;
    },
    /**
     * @param {string} time 
     * @returns {Number}
     */
    getPrayerIndexByTime: function (time) {
        var index = null;
        $.each(prayer.getTimes(), function (i, t) {
            if (t === time) {
                index = i;
            }
        });
        return  index;
    },
    /**
     * handle custom time
     * chourouk time
     * aid time if enabled
     * imsak time if enabled
     */
    setCustomTime: function () {
        // hide all custom times
        $(".custom-time").hide();

        // if aid time enabled we set/show it
        if (this.confData.aidTime) {
            $(".aid-id").text(this.confData.aidTime);
            $(".aid").show();
            return;
        }

        // set chourouk time
        $(".chourouk-id").text(this.getChouroukTime());

        // if imsak enabled
        if (parseInt(this.confData.imsakNbMinBeforeSobh) === 0) {
            $(".chourouk").show();
            return;
        }

        // if imsak time enabled we show it between chourouk + 1 hour and sobh
        var imsak = this.getImsak();
        $(".imsak-id").text(imsak);

        if (parseInt(this.confData.imsakNbMinBeforeSobh) !== 0) {
            var date = new Date();
            var midnight = new Date();
            midnight.setHours(0);
            midnight.setMinutes(0);
            midnight.setSeconds(0);
            var sobhDate = prayer.getCurrentDateForPrayerTime(prayer.getTimeByIndex(0));
            // if time betwwen midnight and sobh => show imsak
            if (date.getTime() < sobhDate.getTime() && date.getTime() > midnight.getTime()) {
                $(".imsak").show();
                return;
            }

            var chouroukDate = prayer.getCurrentDateForPrayerTime(prayer.getChouroukTime());
            chouroukDate = chouroukDate.setHours(chouroukDate.getHours() + 1);
            // if time > chourouk + 1 hour => show imsak
            if (date.getTime() > chouroukDate) {
                $(".imsak").show();
                return;
            }

            // default show chourouk
            $(".chourouk").show();
        }
    },
    /**
     * set all prayer times 
     */
    setTimes: function () {
        $(".sobh").text(this.getTimes()[0]);
        $(".dohr").text(this.getTimes()[1]);
        $(".asr").text(this.getTimes()[2]);
        $(".maghrib").text(this.getTimes()[3]);
        $(".ichaa").text(this.getIchaTime());
        $(".joumouaa-id").text(this.getJoumouaaTime());
    },
    /**
     * set wating times
     */
    setWaitings: function () {
        $(".wait").each(function (i, e) {
            $(e).text(prayer.getWaitingTimes()[i % 5] + "'");
        });
    },
    hideSpinner: function () {
        $(".main").fadeIn(1000, function () {
            $(".spinner").hide();
        });
    },
    /**
     * Arabic handler
     */
    translateToArabic: function () {
        if (lang === "ar") {
            var texts = $(".prayer-text").find("div");
            var times = $(".prayer-time").find("div");
            var waits = $(".prayer-wait").find("div");
            for (var i = 4; i >= 0; i--) {
                $(".prayer-text").append(texts[i]);
                $(".prayer-time").append(times[i]);
                $(".prayer-wait").append(waits[i]);
            }
            $(".ar").css({"font-family": "Amiri", 'font-size': '130%'});
            $(".mobile .ar").css({'font-size': '180%'});
            $(".adhan .title, .douaa-between-adhan-iqama .title").css("margin-bottom", "80px");
            $(".adhan .ar, .douaa-between-adhan-iqama .ar, .jumua-dhikr-reminder .ar").css("font-size", "850%");
            $(".slider .title").css("font-size", "1000%");
            $(".header").css("font-size", "700%");
            $(".mobile .header").css("font-size", "250%");
            $(".site").css("font-size", "200%");
        }
    },
    /**
     * Init events
     */
    initEvents: function () {
        $(".version").click(function () {
            prayer.test();
        });
    },
    /**
     * Check if we are in praying moment (10 min before afhan and and 20 min after iqamah)
     */
    isPrayingMoment: function () {
        var isPrayingMoment = false;
        var date = new Date();
        var beginDateTime, endDateTime, prayerDateTime;
        $(prayer.getTimes()).each(function (i, time) {
            prayerDateTime = prayer.getCurrentDateForPrayerTime(time);
            beginDateTime = prayerDateTime.setMinutes(prayerDateTime.getMinutes() - 10);
            endDateTime = prayerDateTime.setMinutes(prayerDateTime.getMinutes() + prayer.getWaitingByIndex(i) + 20);
            if (date > beginDateTime && date < endDateTime) {
                isPrayingMoment = true;
                return false;
            }
        });

        return isPrayingMoment;
    },
    /**
     * Test main app features 
     */
    test: function () {
        // show douaa after prayer
        douaaSlider.oneDouaaShowingTime = 2000;
        douaaSlider.show();
        setTimeout(function () {
            // show douaa after adhan
            prayer.douaa.showAdhanDouaa();
            setTimeout(function () {
                prayer.douaa.hideAdhanDouaa();
            }, 3000);
            setTimeout(function () {
                //show hadith between adhan and iqama
                prayer.douaa.showHadith();
                setTimeout(function () {
                    prayer.douaa.hideHadith();
                    // flash adhan
                    prayer.adhanFlashingTime = 10000;
                    prayer.flashAdhan(4);
                    setTimeout(function () {
                        // flash iqama
                        prayer.flashIqama(4);
                        setTimeout(function () {
                            location.reload();
                        }, 10000);
                    }, prayer.adhanFlashingTime);
                }, 5000);
            }, 5000);
        }, douaaSlider.getTimeForShow() + 3000);
    }
};

$(document).ready(function () {
    prayer.init();
});
