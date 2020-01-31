import { IpcRenderer } from 'electron';
import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { NgTerminal } from 'ng-terminal';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('term', { static: true }) child: NgTerminal;

  private readonly ACTIVATION_CODE = '1234';
  private enteredCode = '';
  private attempts = 3;
  private ipc: IpcRenderer;

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
    }
  }

  private success() {
    this.child.write('\r\n\nYou made it! The code was correct!!!');
  }

  ngOnInit(): void {
    try {
      this.ipc = (window as any).require('electron').ipcRenderer;
    } catch (e) {
      throw e;
    }
  }

  ngAfterViewInit(): void {
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
          }

          if (this.checkActivationCode()) {
            this.success();
          } else {
            this.fail();
          }

          this.resetEnteredCode();
        }
        this.child.write('\r\n\n$ ');
      } else if (ev.keyCode === 8) {
        // Do not delete the prompt
        if (this.child.underlying.buffer.cursorX > 2) {
          this.child.write('\b \b');
        }

        if (this.enteredCode.length > 0) {
          this.enteredCode = this.enteredCode.slice(0, -1);
        }
      } else if (printable) {
        this.child.write(e.key);

        this.enteredCode += e.key;
      }

      // console.log(this.enteredCode);
    });
  }
}
