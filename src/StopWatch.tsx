import {Seven} from 'seven-segment';
import {createEffect, createResource, createSignal, onCleanup, onMount} from "solid-js";
import styleString from './index.css?inline';
import {SEPARATORS} from "./separators";
import {customElement} from "solid-element";
import { debounce } from "@solid-primitives/scheduled";


customElement('mbt-stopwatch', () => {
    let canvas: HTMLCanvasElement;

    enum TimeCommand {
        INIT = 0,
        START = 1,
        PAUSE = 2,
        RESET = 3,
        DESTROY = 4
    }

    const resizeObserver = new ResizeObserver((entry) => {
        setCanvasParentWidth(entry[0].contentRect.width);
        if(watchActive()){
            debouncedAnimate();
        }else{
            renderWatchFace(digits());
        }
    });
    const canvasSizeObserver = new ResizeObserver(entries => {
        if (entries[0].contentRect.width > 0 && !watchActive()) {
            setCanvasInit(true);
        }
    });

    const [centiseconds, setCentiseconds] = createSignal(0);
    const [digits] = createResource(centiseconds, createDigits);
    const [intervalID, setIntervalID] = createSignal(Number());
    const [watchActive, setWatchActive] = createSignal(false);
    const [watchStarted, setWatchStarted] = createSignal(false);
    const [currentTimeCommand, setCurrentTimeCommand] = createSignal(0);
    const [canvasParentWidth, setCanvasParentWidth] = createSignal(0)
    const [canvasInit, setCanvasInit] = createSignal(false);
    const [animationFrame, setAnimationFrame] = createSignal(0);
    let frame = requestAnimationFrame(animate);

    function animate() {
        if(currentTimeCommand()!==1) {
            cancelAnimationFrame(frame);
            return;
        }else{
            frame = requestAnimationFrame(animate);
            setAnimationFrame(frame);
            renderWatchFace(digits());
        }
    }
const debouncedAnimate = debounce(() => animate(), 250);
    function createDigits(centiseconds: number): number[] {
        if (centiseconds === 0) return [10, 10, 10, 10, 10, 10, 10];
        let centisecondArray = Array.from(centiseconds.toString().padStart(2, '0').slice(-2), Number);
        let secondsArray = Array.from(Math.floor((centiseconds % 6000) / 100).toFixed(0).toString().padStart(2, '0'), Number).map((value, index, array) => {
            if (centiseconds > 6000) {
                return value;
            } else if (centiseconds < 100) {
                return 10;
            } else if (value === 0 && array[index + 1] > 0) {
                return 10;
            } else {
                return value;
            }
        });
        let minutesArray = Array.from(Math.floor(centiseconds / 6000).toString().padStart(3, '0'), Number).map((value, index, array) => {
            if (index === 0 && value > 0) {
                return value
            } else if (centiseconds < 6000) {
                return 10;
            } else if (index === 0 && array[index + 1] === 0) {
                return 10;
            } else if (value === 0 && array[index + 1] > 0) {
                return 10
            } else if (value === 0 && array[index + 1] > 0 && array[index - 1] === 0) {
                return 10;
            } else {
                return value;
            }
        });
        return Array.prototype.concat(minutesArray, secondsArray, centisecondArray);
    }

    function renderWatchFace(digits = [10, 10, 10, 10, 10, 10, 10]) {
        if (!canvas || canvas.height === 0) return;
        const context = canvas.getContext('2d', {willReadFrequently: true});
        if (!context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const startingPositions = [0,
            (canvas.height / 1.75),
            2 * (canvas.height / 1.75),
            3.2 * (canvas.height / 1.75),
            4.2 * (canvas.height / 1.75),
            5.4 * (canvas.height / 1.75),
            6.4 * (canvas.height / 1.75)
        ]
        digits.forEach((digit, index) => {
            // todo check if digit to the right is active, if not skip drawing, unless it is the first digit
            if (!canvas) return;
            const startingXPosition = startingPositions[index]
            new Seven({height: canvas.height, angle: 0, digit: digit}).segments.forEach(segment => {
                context.beginPath();
                segment.points.forEach(point => {
                    context.lineTo(point.x + startingXPosition, point.y)
                });
                context.closePath();
                context.fillStyle = `rgba(0,0,0, ${segment.on ? '1' : '.15'})`;
                context.fill();
            });
            if (index === 2 || index === 4) {
                const separatorStartingXPosition = startingXPosition + canvas.height / 2.265
                context.beginPath();
                SEPARATORS.forEach(value => {
                    if (!canvas) return;
                    if (value.type === 'moveTo') {
                        context.moveTo(separatorStartingXPosition + (value.x * canvas.height) / 100, (value.y * canvas.height) / 100);
                    } else if (value.type === 'lineTo') {
                        context.lineTo(separatorStartingXPosition + (value.x * canvas.height) / 100, (value.y * canvas.height) / 100);
                    }
                })
                context.closePath();
                if (index === 2) {
                    context.fillStyle = `rgba(0,0,0,${digits[2] !== 10 ? '1' : '.15'})`;
                } else {
                    context.fillStyle = `rgba(0,0,0,${digits[4] !== 10 ? '1' : '.15'})`;
                }
                context.fill();
            }
        })
    }

    function controlTime(command: TimeCommand) {
        setCurrentTimeCommand(Number(command));
        if (command === TimeCommand.INIT) {
            if(watchStarted()) return;
            renderWatchFace();
            cancelAnimationFrame(animationFrame());
        } else if (command === TimeCommand.START) {
            setIntervalID(setInterval(() => setCentiseconds(centiseconds() + 1), 10));
            setWatchStarted(true);
            frame = requestAnimationFrame(animate);
        } else if (command === TimeCommand.PAUSE) {
            clearInterval(intervalID());
            cancelAnimationFrame(animationFrame());
            setIntervalID(Number);
        } else if (command === TimeCommand.RESET) {
            clearInterval(intervalID());
            cancelAnimationFrame(animationFrame());
            setCentiseconds(0);
            renderWatchFace();
            setWatchActive(false);
            setWatchStarted(false);
        } else if (command === TimeCommand.DESTROY) {
            clearInterval(intervalID());
            cancelAnimationFrame(animationFrame());
            setWatchActive(false);
            setWatchStarted(false);
        } else return;
    }

    function toggle() {
        if (!watchActive()) {
            controlTime(TimeCommand.START);
        } else {
            controlTime(TimeCommand.PAUSE);
        }
        setWatchActive(!watchActive());
    }

    function initStopwatch(canvasInit: boolean) {
        if (!canvasInit) return;
        controlTime(TimeCommand.INIT);
        setCanvasInit(false);
    }

    onMount(() => {
        resizeObserver.observe(canvas.parentElement!);
        canvasSizeObserver.observe(canvas);
        createEffect(() => initStopwatch(canvasInit()));
    });
    onCleanup(() => {
        controlTime(TimeCommand.DESTROY);
    });

    return (<>
        <style>{styleString}</style>
        <article class="relative">
            <header class="absolute bottom-0 w-full h-px">
                <h1 class="sr-only">Stopwatch</h1>
                <svg height="40" viewBox="0 0 552.03 521.4" xmlns="http://www.w3.org/2000/svg"
                     class="absolute bottom-0 right-0 z-10 bg-white">
                    <g transform="translate(2.5701 2.5701)">
                        <path
                            d="m126.32 61.423c-14.264 0.5035-43.377 2.1042-50.23 13.964-3.9195 0.74772-11.308 0.86512-21.361 1.8649-10.669 1.3631-15.477 0.36018-27.596 6.7351-20.883 7.5228 14.125 8.3023 17.419 9.4127 21.122 3.0792 37.005 13.278 45.371 34.207 2.8879 18.348-0.30825 33.361 7.5022 49.757 6.6218 10.244 8.1774 23.213 14.21 34.292 13.85 25.45 31.568 39.601 50.945 60.591 5.7477 8.8997 14.129 9.5567 21.605 18.179 1.6277-0.47547 10.62 7.4958 8.7852 5.4586 9.3109 4.811 20.823 9.1537 12.506 27.599-14.9 14.179-20.115 37.269-39.093 45.805-15.596 5.1937-25.513 6.2938-40.792 14.928-10.185 3.3881-22.47 44.92-9.4166 17.688 10.615-17.977 35.214-24.665 54.001-27.438 14.667-0.56196 25.72-4.1759 39.796-1.5427 10.122-1.2763 30.947 17.5 39.542 11.447 9.4875-1.346 17.725 26.95 10.723 7.5488-4.2924-19.954-65.096-12.488-45.715-39.413 10.925-13.894 20.413-33.734 34.627-42.253 12.371 4.6742 20.853-1.4814 33.373-1.7261 3.5422-4.6094 10.899-2.1251 14.235-6.695 17.216 2.5297 32.399 15.106 47.365 24.145 8.3513 5.7303 21.514 14.522 23.278 8.4603 9.5277 0.51835 31.907 18.829 36.423 10.283 18.438 14.377 36.035 30.182 55.749 42.931 16.244 13.732 30.758 31.748 51.501 37.901 8.3713 0.27787 14.386-17.049 3.7883-26.124-15.694-16.631-32.605-32.253-49.428-47.755-23.434-13.52-45.762-28.891-66.963-45.747-8.5279-10.245-17.972-20.211-26.038-28.878 10.207 5.8279-14.6-16.846-16.783-22.396-9.8072-11.48 4.9689-1.4196-1.5381-9.166 6.3346 0.48032 10.697 5.8027 3.8088-5.6718 8.6671 7.3917-8.7319-12.601-12.54-14.665-9.5051-15.519-26.771-27.634-40.329-40.65-17.892-8.9113-26.979-26.15-42.255-38.085-6.0494-8.4147-12.403-7.695-20.77-14.757-18.208-11.595-22.421-14.634-37.033-30.642-14.315-13.977-32.238-31.027-54.75-36.055-5.1576-0.73289-18.727-3.3802-23.922-3.537zm-19.244 19.788c1.1578-0.0209 2.9799-0.0702 5.6207 1.843 4.661 8.8212-11.499 16.593-13.314 4.6648 0.49779-5.4499 4.2198-6.4453 7.6931-6.5079zm-1.8267 2.4542c-4.6775 0.93686-3.0543 6.9943 1.8919 6.1969 2.8998-1.8234 2.3182-6.6703-1.8919-6.1969zm121.76 67.324h5.1654v42.77h-5.1654v-3.2167c-1.4836 1.2827-3.0313 2.2814-4.643 2.996-1.6118 0.71467-3.3608 1.0726-5.2473 1.0726-3.6632 0-6.5755-1.4114-8.7368-4.2334-2.143-2.822-3.2139-6.734-3.2139-11.737 0-2.6021 0.36599-4.9208 1.0986-6.9548 0.75095-2.034 1.7583-3.7649 3.0221-5.1942 1.2455-1.3927 2.693-2.4558 4.3414-3.1888 1.6667-0.73298 3.3878-1.0996 5.1644-1.0996 1.6118 0 3.041 0.17414 4.2865 0.52231 1.2455 0.32984 2.5543 0.85227 3.928 1.5669zm-89.088 1.8416h7.4184l10.907 22.786 10.55-22.786h7.5553v40.928h-5.44v-35.266l-11.373 23.996h-3.2418l-11.292-23.996v35.266h-5.0834zm111.45 9.3727c4.1394 0 7.3262 1.2094 9.5608 3.6282 2.2528 2.4188 3.3796 5.8546 3.3796 10.307v2.8043h-22.611c0 1.8874 0.28411 3.5365 0.8519 4.9475 0.56779 1.3927 1.346 2.5376 2.335 3.4355 0.95242 0.87958 2.0792 1.5396 3.3796 1.9794 1.3187 0.43978 2.7653 0.65916 4.3405 0.65916 2.088 0 4.1856-0.4118 6.2919-1.2364 2.1246-0.84292 3.6348-1.6675 4.5323-2.4737h0.27559v5.6346c-1.74 0.73299-3.5169 1.3468-5.3302 1.8416-1.8133 0.49477-3.7182 0.74203-5.7147 0.74203-5.0918 0-9.0664-1.3739-11.924-4.1226-2.8573-2.767-4.2855-6.6886-4.2855-11.765 0-5.0209 1.3647-9.007 4.0937-11.957 2.7474-2.9503 6.3551-4.4252 10.824-4.4252zm-59.664 0.10986c2.1613 0 4.0383 0.18375 5.6318 0.55024 1.6118 0.34817 3.0044 0.95239 4.1766 1.8136 1.1539 0.84293 2.0332 1.933 2.6376 3.2707s0.90589 2.9964 0.90589 4.9754v20.836h-5.1374v-3.2716c-0.4579 0.31152-1.0801 0.75121-1.8676 1.3193-0.76926 0.54974-1.5205 0.99036-2.2531 1.3202-0.86084 0.42147-1.8499 0.76882-2.9672 1.0437-1.1173 0.29319-2.427 0.44037-3.929 0.44037-2.7657 0-5.1098-0.91687-7.033-2.7493-1.9232-1.8325-2.8853-4.1685-2.8853-7.0088 0-2.3272 0.49501-4.2053 1.4841-5.6346 1.0074-1.4476 2.4356-2.5839 4.2855-3.4085 1.8682-0.82461 4.1122-1.3836 6.7314-1.6768 2.6192-0.2932 5.4304-0.51351 8.4342-0.66011v-0.79695c0-1.1728-0.20998-2.1436-0.63125-2.9132-0.40294-0.76964-0.98944-1.3748-1.7587-1.8146-0.73263-0.42147-1.6119-0.7053-2.6376-0.8519-1.0257-0.14659-2.0967-0.21972-3.2139-0.21972-1.3554 0-2.8664 0.18282-4.5332 0.54931-1.6667 0.34816-3.3887 0.86192-5.1654 1.5399h-0.27466v-5.2501c1.0074-0.27487 2.4636-0.57698 4.3684-0.90682s3.7819-0.49531 5.6318-0.49531zm59.39 4.1505c-2.7657 0-4.9731 0.81586-6.6215 2.4468-1.6301 1.6309-2.5547 3.6552-2.7745 6.074h17.583c-0.0183-2.712-0.70593-4.8104-2.0613-6.2947-1.337-1.4843-3.3788-2.2261-6.1262-2.2261zm-29.42 0.46737c-2.8939 0-5.1475 1.0083-6.7593 3.024-1.6118 2.0157-2.417 4.8742-2.417 8.5757 0 3.6466 0.62218 6.4223 1.8676 8.3281 1.2455 1.8874 3.242 2.8313 5.9893 2.8313 1.4653 0 2.9494-0.3204 4.4513-0.96176 1.5019-0.65969 2.9022-1.5025 4.2027-2.5287v-17.62c-1.392-0.62303-2.6373-1.0531-3.7362-1.2913s-2.298-0.35752-3.5984-0.35752zm-21.755 10.72c-1.5752 0.0916-3.4339 0.22919-5.5769 0.41244-2.1246 0.18325-3.81 0.44879-5.0555 0.79696-1.4836 0.42147-2.6826 1.0815-3.5984 1.9794-0.91579 0.87958-1.3742 2.0976-1.3742 3.6552 0 1.7592 0.53161 3.0878 1.5939 3.9857 1.0623 0.87958 2.6832 1.3193 4.8628 1.3193 1.8133 0 3.4707-0.34828 4.9726-1.0446 1.5019-0.71467 2.8936-1.5662 4.1757-2.5557zm-28.198 19h10.732c2.6444 0 4.624 0.10243 5.9381 0.30724s2.5711 0.6316 3.7716 1.2802c1.3303 0.7339 2.2952 1.6809 2.8955 2.8415 0.60025 1.1435 0.9003 2.5173 0.9003 4.1217 0 1.8092-0.43763 3.3537-1.3137 4.6337-0.87605 1.263-2.0443 2.2792-3.5044 3.0473v0.20483c2.4497 0.52909 4.3805 1.6639 5.7919 3.4048 1.4114 1.7238 2.1172 3.9081 2.1172 6.5535 0 1.8945-0.34089 3.5675-1.0223 5.0183-0.68138 1.4507-1.5984 2.6448-2.7503 3.5835-1.3628 1.1265-2.863 1.9288-4.5015 2.4067-1.6223 0.4779-3.6907 0.7169-6.2053 0.7169h-12.849zm4.819 4.3265v11.009h6.2295c1.5088 0 2.709-0.0764 3.6012-0.22997 0.89228-0.17067 1.7196-0.5121 2.4821-1.0241 0.76249-0.51202 1.2978-1.1698 1.606-1.9719 0.32447-0.81923 0.48694-1.7833 0.48694-2.8927 0-0.92165-0.1465-1.698-0.43852-2.3294s-0.76159-1.1436-1.4105-1.5362c-0.7625-0.46083-1.6875-0.74205-2.7745-0.84445-1.087-0.11947-2.4336-0.17969-4.0397-0.17969zm20.388 5.197h4.9643l8.3467 21.198 8.4202-21.198h4.7939l-15.867 39.144h-4.8907l5.0611-11.93zm-20.388 10.087v14.183h6.3757c2.109 0 3.8365-0.11051 5.183-0.33239 1.3465-0.23894 2.45-0.66573 3.3098-1.2802 0.9085-0.66562 1.5734-1.4258 1.9952-2.2792 0.42181-0.85337 0.63218-1.954 0.63218-3.3024 0-1.5361-0.21835-2.7562-0.65638-3.6608-0.43803-0.90458-1.2335-1.6728-2.3853-2.3043-0.77872-0.42668-1.7277-0.69983-2.8471-0.8193-1.1032-0.13654-2.4499-0.20483-4.0398-0.20483zm-4.873 22.157h31.77v4.1105h-13.393v30.665h-4.9847v-30.665h-13.393zm35.952 7.964c3.9441 0 7.091 1.2382 9.4406 3.7139 2.3497 2.4601 3.524 5.8156 3.524 10.066s-1.1743 7.6062-3.524 10.066c-2.3496 2.4601-5.4966 3.6897-9.4406 3.6897-3.9776 0-7.1413-1.2296-9.4909-3.6897-2.3329-2.4601-3.4998-5.8156-3.4998-10.066s1.1669-7.6062 3.4998-10.066c2.3496-2.4757 5.5133-3.7139 9.4909-3.7139zm28.198 0c1.9133 0 3.5332 0.37453 4.859 1.1219 1.3427 0.74736 2.3406 1.7824 2.9951 3.1059 1.9133-1.4947 3.6594-2.5693 5.237-3.2232 1.5776-0.66951 3.2643-1.0046 5.0602-1.0046 3.0881 0 5.3624 0.87235 6.8226 2.6162 1.4769 1.7283 2.2149 4.1499 2.2149 7.2639v16.932h-4.7324v-14.854c0-1.121-0.0594-2.2033-0.17691-3.2465-0.10069-1.0432-0.3272-1.8761-0.67965-2.4989-0.38601-0.66951-0.93927-1.175-1.661-1.5176-0.72168-0.34254-1.7623-0.51393-3.1218-0.51393-1.3259 0-2.6524 0.31102-3.9783 0.93383-1.3259 0.60723-2.6515 1.3862-3.9774 2.336 0.0503 0.3581 0.0921 0.77793 0.12569 1.2606 0.0336 0.4671 0.0503 0.93409 0.0503 1.4012v16.699h-4.7324v-14.854c0-1.1522-0.0585-2.2422-0.17597-3.2698-0.10069-1.0432-0.3272-1.8761-0.67965-2.4989-0.38601-0.66952-0.94021-1.1673-1.6619-1.4943-0.72168-0.34254-1.7623-0.51393-3.1217-0.51393-1.2923 0-2.5929 0.29561-3.902 0.88728-1.2923 0.59166-2.5845 1.3466-3.8768 2.2652v19.478h-4.7334v-26.087h4.7334v2.8964c1.4769-1.1366 2.9455-2.0244 4.4056-2.6627 1.4769-0.63838 3.0458-0.95804 4.7073-0.95804zm-28.198 3.7837c-2.5678 0-4.5655 0.82518-5.9921 2.4756-1.4098 1.6349-2.1144 4.1422-2.1144 7.5209 0 3.2697 0.71386 5.753 2.1404 7.4501 1.4266 1.6816 3.415 2.5222 5.966 2.5222 2.5175 0 4.4892-0.83289 5.9158-2.4989 1.4434-1.6816 2.1656-4.1725 2.1656-7.4734 0-3.3787-0.71386-5.886-2.1404-7.5209-1.4266-1.6504-3.4066-2.4756-5.9409-2.4756zm23.01 61.025c13.334 6.7179-6.838 17.885-13.825 30.664-9.0929 7.1373-15.175 31.916-26.41 17.873 10.948-19.481 32.08-48.76 40.234-48.536z"
                            stroke-width=".48118"/>
                        <path
                            d="m162.77 475.49a0.97346 0.97312 0 0 1-0.97346 0.97314m-0.97181-0.97149a0.97346 0.97312 0 0 0 0.97345 0.9731m-0.97333-0.97326a1.947 1.9464 0 0 1 1.947-1.9464m2.9205 2.9198a2.9206 2.9196 0 0 0-2.9206-2.9196m2.9208 2.9195a4.8678 4.8661 0 0 1-4.8678 4.8661m-7.7887-7.786a7.7886 7.7858 0 0 0 7.7885 7.7858m-7.7884-7.7857a12.656 12.652 0 0 1 12.656-12.652m20.445 20.438a20.445 20.438 0 0 0-20.445-20.438m20.445 20.438a33.102 33.09 0 0 1-33.102 33.09m-1.4e-4 1.3e-4a53.547 53.528 0 0 1-53.547-53.528m1.6e-4 -1.4e-4a86.649 86.619 0 0 1 86.649-86.619m140.2 140.15a140.2 140.15 0 0 0-140.2-140.15"
                            fill="none" stroke="#000" stroke-width="4.0397"/>
                        <rect width="546.89" height="516.26" fill="none" stroke="#000"
                              stroke-dasharray="10.2805, 25.7012, 10.2805, 35.9818, 0" stroke-width="5.1402"/>
                    </g>
                </svg>
            </header>
            <section id="stopwatch" class="relative flex flex-col md:flex-row justify-between p-5 rounded">
                <div class="md:w-4/5">
                    <canvas id={'watchFace'} ref={canvas!} class="m-auto" width={canvasParentWidth()}
                            height={(canvasParentWidth() / 8.5) * 2}/>
                </div>
                <div class="md:w-1/5">
                    <menu class='flex flex-row md:flex-col justify-between md:ml-2 border-2 md:h-full mt-2 md:mt-0'>
                        <li class='flex text-center w-1/2 md:w-full items-center justify-center md:h-full'>
                            <button
                                onClick={toggle}
                                class='h-[60px] w-[100px] p-2 flex items-center justify-center'
                            >
                                <svg
                                    version="1.1"
                                    viewBox="0 -960 560 320"
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="transition delay-100 duration-200 ease-in-out max-h-[40px]"
                                    classList={{
                                        'hover:text-green-600 hover:fill-current': !watchStarted(),
                                        'fill-green-600': watchStarted() && watchActive(),
                                        'fill-green-500 animate-pulse': currentTimeCommand() === 2,
                                    }}
                                >
                                    <path d="m0-652v-296l220 148zm340 12v-320h60v320zm160 0v-320h60v320z"/>
                                </svg>
                            </button>
                        </li>
                        <li class="border-l-2 md:border-b-2"></li>
                        <li class='flex text-center w-1/2 md:w-full items-center justify-center md:h-full'>
                            <button
                                onClick={[controlTime, TimeCommand.RESET]}
                                disabled={!watchStarted()}
                                class='h-[60px] w-[100px] p-2 flex items-center justify-center'
                            >
                                <svg
                                    version="1.1"
                                    viewBox="0 -960 720 720"
                                    xmlns="http://www.w3.org/2000/svg"
                                    class='max-h-[40px]'
                                    classList={{
                                        'transition delay-300 duration-500 ease-in-out hover:text-red-600 hover:fill-current hover:animate-spin': watchStarted(),
                                    }}
                                    style='animation-direction: reverse'
                                >
                                    <path
                                        d="m357-240q-149 0-253-105.5t-104-255.5h60q0 125 86 213t211 88q127 0 215-89t88-216q0-124-89-209.5t-214-85.5q-68 0-127.5 31t-103.5 82h105v60h-209v-208h60v106q52-61 123.5-96t151.5-35q75 0 141 28t115.5 76.5 78 113.5 28.5 140-28.5 141-78 115-115.5 77.5-141 28.5zm128-197-154-152v-214h60v189l137 134z"/>
                                </svg>
                            </button>
                        </li>
                    </menu>
                </div>
            </section>
        </article>
    </>);
})


//todo you could probably refactor this to be simpler
//todo add this to monorepo
//todo possible draw on multiple canvases
//todo add eslint
//todo add prettier