import { NgModule, APP_INITIALIZER } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ShellModule } from './features/shell/shell.module';
import { DatabaseService } from './core/services/database.service';
import { DojoService } from './core/services/dojo.service';

function initializeApp(dbService: DatabaseService, dojoService: DojoService) {
  return async () => {
    await dbService.init();
    dojoService.initSelection();
  };
}

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    ShellModule
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [DatabaseService, DojoService],
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
