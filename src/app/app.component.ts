import * as moment from 'moment';
import { IpcRenderer } from 'electron';
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { NgTerminal } from 'ng-terminal';
import { BehaviorSubject, interval, Observable, Subject, zip } from 'rxjs';
import { Moment } from 'moment';
import { concatMap, filter, first, map, startWith, take, takeWhile, tap } from 'rxjs/operators';

const HELP_MESSAGES = [
  'Uno dei membri dell\'equipaggio ha un evidente difetto fisico',
  'Uno dei membri dell\'equipaggio non vede la figlia da quando è nata',
  'Per scoprire il numero di uno dei membri dell\'equipaggio può essere utile provare a guardare le cose da un\'altra prospettiva',
  'Hai terminato gli aiuti'
];

const VICTORY_MESSAGE = '\r\n\nMisure d\'emergenza attivate.\r\nSiete liberi di tornare sulla terra';
const FAIL_MESSAGE = '\r\n\nMisure d\'emergenza disattivate.\r\nMissione fallita';
const SLOW_TEXT_DELAY = 20;

interface SlowWriter {
  defaultDelay: number;
  getEmitter(): Observable<string>;
  write(message: string, delay?: number): void;
}

class SlowWriterFactory {
  static createWriter(defaultDelay: number): SlowWriter {
    const message$ = new Subject();
    const emitter$: Observable<string> = message$.pipe(
      concatMap(([message, delay]) => {
        const length = message.length;

        return interval(delay).pipe(
          take(length - 1),
          map(index => index + 1),
          startWith(0),
          map(index => message[index]),
        )
      })
    );

    return {
      defaultDelay: defaultDelay,
      getEmitter: () => emitter$,
      write: function(message, delay) {
        message$.next([message, delay ? delay : this.defaultDelay])
      }
    }
  }
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('term', { static: false }) terminal: NgTerminal;
  @ViewChild('introvideo', {static: false})
  set introvideo (el: ElementRef) {
    this.videoPlayer = el ? el.nativeElement : null
  }

  private readonly ENTERED_CODE_MAX_LENGTH = 7;
  private readonly ACTIVATION_CODE = '4158193';
  private readonly TIMER_START_SECONDS = 30 * 60; // 30 minutes
  private enteredCode = '';
  private attempts = 3;
  private ipc: IpcRenderer;
  private isTerminalInputLocked = false;
  private videoPlayer: HTMLVideoElement;
  private isCountdownStopped = false;
  private helpMessageIndex = 0;
  private newSlowWriter: SlowWriter;

  gameState$: Subject<'intro' | 'console'> = new BehaviorSubject('intro');
  countDown$: Observable<Moment>;
  gameEnding: 'fail' | 'success';

  constructor() {}

  private checkActivationCode() {
    return this.enteredCode === this.ACTIVATION_CODE;
  }

  private resetEnteredCode() {
    this.enteredCode = '';
  }

  private fail() {
    this.attempts -= 1;
    if (this.attempts > 0) {
      this.newSlowWriter.write(`\r\n\nCodice di attivazione errato\r\n${this.attempts} tentativi rimasti`);
    } else {
      this.isTerminalInputLocked = true;
      this.isCountdownStopped = true; // FIXME
      this.gameEnding = 'fail';
      this.newSlowWriter.write(FAIL_MESSAGE);
    }
  }

  private success() {
    this.isTerminalInputLocked = true;
    this.isCountdownStopped = true; // FIXME
    this.gameEnding = 'success';
    this.newSlowWriter.write(VICTORY_MESSAGE);
  }

  private initConsole() {
    this.terminal.underlying.focus();
    this.terminal.underlying.setOption('cursorBlink', true);

    this.newSlowWriter = SlowWriterFactory.createWriter(SLOW_TEXT_DELAY);
    this.newSlowWriter.getEmitter().subscribe(character => this.terminal.write(character));

    this.newSlowWriter.write(`
  _____          _        ____ ____    _____   ____     _____  ___  \r
 |  ___|__ _ __ (_)_  __ | __ )___ \\  | ____| / ___|   |___ / / _ \\ \r
 | |_ / _ \\ '_ \\| \\ \\/ / |  _ \\ __) | |  _|   \\___ \\     |_ \\| | | |\r
 |  _|  __/ | | | |>  <  | |_) / __/  | |___ _ ___) |   ___) | |_| |\r
 |_|  \\___|_| |_|_/_/\\_\\ |____/_____| |_____(_)____(_) |____(_)___/ \r

CPU1: Core temperature/speed normal\r
CPU3: Package temperature/speed normal\r
CPU7: Core temperature above threshold, cpu clock throttled (total events = 414)\r
ath: EEPROM regdomain: 0x817c\r
ath: doing EEPROM country->regdmn map search\r
ath: Regpair used: 0x37\r
wlp3s0: Limiting TX power to 24 (27 - 3) dBm as advertised by 82:4c:a5:3f:d5:95\r
remote: Reusing existing pack: 1857, done.\r
remote: Total 1857 (delta 0), reused 0 (delta 0)\r
Receiving objects: 100% (1857/1857), 374.35 KiB | 268.00 KiB/s, done.\r
Resolving deltas: 100% (772/772), done.\r
Checking connectivity... done.\r
Switching language... fatto.`, 5);

    this.newSlowWriter.write('\r\n\nInserire il codice per inizializzare le misure di sicurezza:', 5);
    this.newSlowWriter.write('\r\n\n$ ');

    this.terminal.keyEventInput.subscribe(e => {
      const ev = e.domEvent;
      const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey
        && ev.code !== 'ArrowUp'
        && ev.code !== 'ArrowLeft'
        && ev.code !== 'ArrowDown'
        && ev.code !== 'ArrowRight'
        && ev.code !== 'Tab';

      if (ev.keyCode === 13) {
        if (this.enteredCode.length > 0) {
          if (this.enteredCode === 'puppa') {
            this.ipc.send('quit-app');
          } else if (this.enteredCode === 'aiuto') {

            if (this.helpMessageIndex < HELP_MESSAGES.length) {
              this.newSlowWriter.write(`\r\n\n${HELP_MESSAGES[this.helpMessageIndex]}`);
              this.helpMessageIndex += 1;
            }

          } else if (this.enteredCode.match(/[^\d]+/g)) {
            this.newSlowWriter.write(`\r\n\n${this.enteredCode}: comando non trovato`);
          } else {
            if (this.checkActivationCode()) {
              this.success();
            } else {
              this.fail();
            }
          }

          this.resetEnteredCode();
        }

        if (!this.isTerminalInputLocked) {
          this.newSlowWriter.write('\r\n\n$ ');
        }
      } else if (ev.keyCode === 8) {
        // Do not delete the prompt
        if (this.terminal.underlying.buffer.cursorX > 2) {
          this.newSlowWriter.write('\b \b');
        }

        if (this.enteredCode.length > 0) {
          this.enteredCode = this.enteredCode.slice(0, -1);
        }
      } else if (printable && this.enteredCode.length < this.ENTERED_CODE_MAX_LENGTH
        && !this.isTerminalInputLocked) {
        this.newSlowWriter.write(e.key);

        this.enteredCode += e.key;
      }
    });
  }

  ngOnInit(): void {
    this.countDown$ = interval(1000).pipe(
      map(index => this.TIMER_START_SECONDS - index - 1),
      startWith(this.TIMER_START_SECONDS),
      takeWhile(seconds => seconds >= 0 && !this.isCountdownStopped),
      tap(seconds => {
        // Time's UP!
        if (seconds === 0) {
          this.isTerminalInputLocked = true;
          this.gameEnding = 'fail';
          this.newSlowWriter.write(FAIL_MESSAGE);
        }
      }),
      map(seconds => moment().hours(0).minutes(0).seconds(0).seconds(seconds))
    );

    try {
      this.ipc = (window as any).require('electron').ipcRenderer;
    } catch (e) {
      console.error('Not an electron app:', e);
    }
  }

  ngAfterViewInit(): void {
    this.gameState$.pipe(
      filter(gameState => gameState === 'intro'),
      first() // Only once
    ).subscribe(() => {
      setTimeout(() => { // Manage ViewChild issues
        this.videoPlayer.addEventListener('ended', (() => {
          this.gameState$.next('console')
        }) as EventListener);
      }, 1);
    });

    this.gameState$.pipe(
      filter(gameState => gameState === 'console'),
      first() // Only once
    ).subscribe(() => {
      setTimeout(() => this.initConsole(), 1); // Manage ViewChild issues
    });

    this.gameState$.next('intro');
  }
}
