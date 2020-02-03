import * as moment from 'moment';
import { IpcRenderer } from 'electron';
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { NgTerminal } from 'ng-terminal';
import { BehaviorSubject, interval, Observable, Subject } from 'rxjs';
import { Moment } from 'moment';
import { filter, first, map, startWith, takeWhile } from 'rxjs/operators';

const HELP_MESSAGES = [
  'Help message number 1',
  'Help message number 2',
  'Help message number 3',
  'No more help messages, sorry'
];

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('term', { static: false }) child: NgTerminal;
  @ViewChild('introvideo', {static: false})
  set introvideo (el: ElementRef) {
    this.videoPlayer = el ? el.nativeElement : null
  }

  private readonly  ENTERED_CODE_MAX_LENGTH = 7;
  private readonly ACTIVATION_CODE = '1234567';
  private readonly TIMER_START_SECONDS = 120;
  private enteredCode = '';
  private attempts = 3;
  private ipc: IpcRenderer;
  private isTerminalInputLocked = false;
  private videoPlayer: HTMLVideoElement;
  private isCountdownStopped = false;
  private helpMessageIndex = 0;

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
      this.child.write(`\r\n\nWrong activation code\r\n${this.attempts} attempts remaining`);
    } else {
      this.child.write(`\r\n\nNo more attempts!`);
      this.isTerminalInputLocked = true;
      this.isCountdownStopped = true; // FIXME
      this.gameEnding = 'fail';
    }
  }

  private success() {
    this.child.write('\r\n\nYou made it! The code was correct!!!');

    this.isTerminalInputLocked = true;
    this.isCountdownStopped = true; // FIXME
    this.gameEnding = 'success';
  }

  private initConsole() {
    this.child.underlying.focus();
    this.child.underlying.setOption('cursorBlink', true);

    this.child.write(`
remote: Reusing existing pack: 1857, done.\r
remote: Total 1857 (delta 0), reused 0 (delta 0)\r
Receiving objects: 100% (1857/1857), 374.35 KiB | 268.00 KiB/s, done.\r
Resolving deltas: 100% (772/772), done.\r
Checking connectivity... done.`);

    this.child.write('\r\n\nEnter the activation code:');

    this.child.write('\r\n\n$ ');

    this.child.keyEventInput.subscribe(e => {
      // console.log(e.domEvent);

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
          } else if (this.enteredCode === 'help') {

            if (this.helpMessageIndex < HELP_MESSAGES.length) {
              this.child.write(`\r\n\n${HELP_MESSAGES[this.helpMessageIndex]}`);
              this.helpMessageIndex += 1;
            }

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
          this.child.write('\r\n\n$ ');
        }
      } else if (ev.keyCode === 8) {
        // Do not delete the prompt
        if (this.child.underlying.buffer.cursorX > 2) {
          this.child.write('\b \b');
        }

        if (this.enteredCode.length > 0) {
          this.enteredCode = this.enteredCode.slice(0, -1);
        }
      } else if (printable && this.enteredCode.length < this.ENTERED_CODE_MAX_LENGTH
        && !this.isTerminalInputLocked) {
        this.child.write(e.key);

        this.enteredCode += e.key;
      }
    });
  }

  ngOnInit(): void {
    this.countDown$ = interval(1000).pipe(
      map(index => this.TIMER_START_SECONDS - index - 1),
      startWith(this.TIMER_START_SECONDS),
      takeWhile(seconds => seconds >= 0 && !this.isCountdownStopped),
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
